"""On-demand offline evals against a Langfuse dataset. Not run by the cron."""

from langfuse.experiment import Evaluation

from observability import tracing
from reviewer import db
from reviewer.llm import ReviewClient, build_profile_block
from reviewer.run import review_one


def verdict_match(expected, actual) -> float:
    """Return 1.0 only when both values are truthy and equal, else 0.0."""
    if not expected or not actual:
        return 0.0
    return 1.0 if expected == actual else 0.0


def seed_dataset_from_reviews(conn, name: str, limit: int) -> int:
    """Push recent stage-2 reviews as dataset items: input=job fields, expected=verdict."""
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot seed dataset")
    lf.create_dataset(name=name)
    rows = db.recent_stage2_reviews(conn, limit)
    for r in rows:
        lf.create_dataset_item(
            dataset_name=name,
            input={
                "title": r["title"],
                "company_name": r["company_name"],
                "location": r["location"],
                "ats": r["ats"],
                "description": r["description"],
                "resume_text": r["resume_text"],
                "instructions": r["instructions"],
            },
            expected_output={"verdict": r["verdict"]},
        )
    lf.flush()
    return len(rows)


def run_experiment(name: str, run_name: str, client=None) -> int:
    """Run an offline experiment against a named Langfuse dataset.

    Args:
        name:     Langfuse dataset name to evaluate against.
        run_name: Label for this experiment run (shown in the Langfuse UI).
        client:   Optional ReviewClient; defaults to ReviewClient() from env.

    Returns:
        Number of dataset items evaluated.
    """
    lf = tracing.get_langfuse()
    if lf is None:
        raise RuntimeError("LANGFUSE_* not set; cannot run experiment")
    client = client or ReviewClient()
    dataset = lf.get_dataset(name)

    async def _task(*, item, **kwargs):
        cand = {"id": f"exp:{item.id}", **item.input}
        block = build_profile_block(
            item.input.get("resume_text"), item.input.get("instructions")
        )
        res = await review_one(cand, block, client)
        return {"verdict": res.verdict, "fit_score": res.fit_score}

    def _verdict_evaluator(*, input, output, expected_output, metadata=None, **kwargs):
        expected = (expected_output or {}).get("verdict")
        actual = (output or {}).get("verdict")
        return Evaluation(name="verdict_match", value=verdict_match(expected, actual))

    result = dataset.run_experiment(
        name=run_name,
        task=_task,
        evaluators=[_verdict_evaluator],
    )
    lf.flush()
    return len(result.item_results)
