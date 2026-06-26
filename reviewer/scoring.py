"""Deterministic overall-fit score (0-100) from the Stage-2 review attributes.

The LLM produces component sub-scores; this module combines them into the
headline fit so the number is reproducible and tunable rather than an LLM
free-pick. Pure and total: tolerates None / unknown enum keys."""

WEIGHTS = {"skills": 0.45, "experience": 0.30, "comp": 0.25}
EXPERIENCE_BONUS = {"match": 4, "step_down": 2, "reach": -3, "far_reach": -8}
CONFIDENCE_BONUS = {"high": 3, "medium": 0, "low": -5}
RED_FLAG_PENALTY = 3
RED_FLAG_PENALTY_CAP = 9
DENY_CAP = 58  # a denied role never shows green


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_fit(*, skills_score, experience_score, comp_score,
                experience_match, confidence, red_flags, verdict) -> int:
    s = skills_score or 0
    e = experience_score or 0
    c = comp_score or 0
    fit = WEIGHTS["skills"] * s + WEIGHTS["experience"] * e + WEIGHTS["comp"] * c
    fit += EXPERIENCE_BONUS.get(experience_match or "", 0)
    fit += CONFIDENCE_BONUS.get(confidence or "", 0)
    fit -= min(RED_FLAG_PENALTY_CAP, RED_FLAG_PENALTY * len(red_flags or []))
    fit = round(_clamp(fit, 0, 100))
    if verdict == "deny":
        fit = min(fit, DENY_CAP)
    return fit
