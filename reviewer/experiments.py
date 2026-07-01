"""On-demand offline evals against a Langfuse dataset. Not run by the cron."""

from langfuse.experiment import Evaluation

from observability import tracing
from reviewer import db
from reviewer.llm import ReviewClient, build_profile_block
from reviewer.run import review_one

GOLDEN_CATEGORICALS = [
    "verdict", "experience_match", "industry", "industry_subcategory",
    "role_category", "seniority", "work_arrangement", "confidence",
]
GOLDEN_SCORES = ["skills_score", "experience_score", "comp_score"]
_SCORE_TOL = 10


def _match(expected, actual) -> float:
    return 1.0 if (expected is not None and actual is not None
                   and expected == actual) else 0.0


def _categorical_evaluator(field: str):
    name = "verdict_match" if field == "verdict" else f"match_{field}"

    def _ev(*, input, output, expected_output, metadata=None, **kwargs):
        exp = (expected_output or {}).get(field)
        act = (output or {}).get(field)
        return Evaluation(name=name, value=_match(exp, act))

    return _ev


def _score_evaluator(field: str, tol: int = _SCORE_TOL):
    def _ev(*, input, output, expected_output, metadata=None, **kwargs):
        exp = (expected_output or {}).get(field)
        act = (output or {}).get(field)
        val = 1.0 if (exp is not None and act is not None
                      and abs(exp - act) <= tol) else 0.0
        return Evaluation(name=f"close_{field}", value=val)

    return _ev


def _field_accuracy_evaluator(*, input, output, expected_output, metadata=None, **kwargs):
    exp, act = expected_output or {}, output or {}
    fields = [f for f in GOLDEN_CATEGORICALS if f != "verdict"]
    scored = [f for f in fields if exp.get(f) is not None]
    hits = sum(1 for f in scored if exp.get(f) == act.get(f))
    return Evaluation(name="field_accuracy",
                      value=(hits / len(scored) if scored else 0.0))


def _stage1_pass_evaluator(client):
    """Return an evaluator that runs stage-1 on the item and scores pass=1.0, reject=0.0.

    Golden items passed the human-curation gate by construction; this evaluator
    checks whether the model's stage-1 gate agrees.
    """
    async def _run(item):
        block = build_profile_block(
            item.input.get("resume_text"), item.input.get("instructions")
        )
        res = await client.stage1(
            profile_block=block,
            title=item.input.get("title", ""),
            company=item.input.get("company_name", ""),
            location=item.input.get("location"),
        )
        return res.decision

    def _ev(*, input, output, expected_output, metadata=None, item=None, **kwargs):
        import asyncio
        if item is None:
            return Evaluation(name="stage1_pass", value=0.0)
        decision = asyncio.run(_run(item))
        return Evaluation(name="stage1_pass", value=1.0 if decision == "pass" else 0.0)

    return _ev


def build_evaluators(client=None) -> list:
    evals = (
        [_categorical_evaluator(f) for f in GOLDEN_CATEGORICALS]
        + [_score_evaluator(f) for f in GOLDEN_SCORES]
        + [_field_accuracy_evaluator]
    )
    if client is not None:
        evals.append(_stage1_pass_evaluator(client))
    return evals


_GOLDEN_FIELDS = GOLDEN_CATEGORICALS + GOLDEN_SCORES


def sync_golden_dataset(conn, name: str = "reviewer-golden") -> int:
    """Push every human correction as a dataset item (upsert by user:job id)."""
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot sync dataset")
    lf.create_dataset(name=name)
    rows = db.golden_corrections(conn)
    for r in rows:
        lf.create_dataset_item(
            dataset_name=name,
            id=f"{r['user_id']}:{r['job_id']}",
            input={k: r[k] for k in ("title", "company_name", "location",
                                     "ats", "description", "resume_text",
                                     "instructions")},
            expected_output={k: r[k] for k in _GOLDEN_FIELDS},
            metadata={"corrected_at": r["corrected_at"].isoformat(),
                      "note": r["note"], "source": "backfill"},
        )
    lf.flush()
    return len(rows)


def run_experiment(name: str, run_name: str, client=None) -> int:
    """Run an offline experiment against a named Langfuse dataset.

    Golden items are fed straight to stage 2 — the gate is evaluated separately
    by the stage1_pass evaluator, so gate quality and stage-2 quality are
    measured independently.

    Args:
        name:     Langfuse dataset name to evaluate against.
        run_name: Label for this experiment run (shown in the Langfuse UI).
        client:   Optional ReviewClient; defaults to ReviewClient() from env.

    Returns:
        Number of dataset items evaluated.
    """
    from reviewer import scoring

    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot run experiment")
    client = client or ReviewClient()
    dataset = lf.get_dataset(name)

    async def _task(*, item, **kwargs):
        """Call stage 2 directly; golden items passed the gate by construction."""
        block = build_profile_block(
            item.input.get("resume_text"), item.input.get("instructions")
        )
        jd = item.input.get("description") or ""
        s2 = await client.stage2(
            profile_block=block,
            title=item.input.get("title", ""),
            company=item.input.get("company_name", ""),
            location=item.input.get("location"),
            jd=jd,
        )
        fit_score = None
        if None not in (s2.skills_score, s2.experience_score, s2.comp_score):
            fit_score = scoring.compute_fit(
                skills_score=s2.skills_score, experience_score=s2.experience_score,
                comp_score=s2.comp_score, experience_match=s2.experience_match,
                confidence=s2.confidence, red_flags=s2.red_flags, verdict=s2.verdict,
            )
        return {
            "verdict": s2.verdict, "fit_score": fit_score,
            "experience_match": s2.experience_match, "industry": s2.industry,
            "industry_subcategory": s2.industry_subcategory,
            "confidence": s2.confidence, "role_category": s2.role_category,
            "seniority": s2.seniority, "work_arrangement": s2.work_arrangement,
            "skills_score": s2.skills_score,
            "experience_score": s2.experience_score, "comp_score": s2.comp_score,
        }

    result = dataset.run_experiment(
        name=run_name, task=_task, evaluators=build_evaluators(client=client),
    )
    lf.flush()
    return len(result.item_results)


def main() -> None:
    import argparse

    from job_discovery import db as poller_db

    parser = argparse.ArgumentParser(prog="reviewer.experiments")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_sync = sub.add_parser("sync", help="seed/reconcile the golden dataset")
    p_sync.add_argument("--name", default="reviewer-golden")
    p_run = sub.add_parser("run", help="run an experiment over the golden dataset")
    p_run.add_argument("--name", default="reviewer-golden")
    p_run.add_argument("--run-name", required=True)
    args = parser.parse_args()

    conn = poller_db.connect()
    try:
        if args.cmd == "sync":
            print(f"synced {sync_golden_dataset(conn, args.name)} item(s)")
        else:
            print(f"evaluated {run_experiment(args.name, args.run_name)} item(s)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
