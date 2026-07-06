"""Deterministic post-parse floors for reviewer soft fields.

Applied at WRITE-TIME in reviewer.run (after the model output is copied onto the
result), so the LangFuse generation output keeps the raw model answer for eval
fidelity. Floors fire ONLY when the model abstained ("unknown"); they never
override a non-unknown model judgment, and never map remote=False/None -> "onsite".
"""
import re


def floor_work_arrangement(work_arrangement: str | None, remote: bool | None) -> str | None:
    if work_arrangement == "unknown" and remote is True:
        return "remote"
    return work_arrangement


# Title ladder words -> seniority token. \b is REQUIRED: it keeps "AI for Leaders",
# "Internal", "Management" from matching lead/intern/manager. "manager" is deliberately
# EXCLUDED (compound role names like "Product Manager" are not a seniority signal).
_SENIORITY_TITLE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(?:intern(?:ship)?|junior|jr\.?)\b", re.IGNORECASE), "junior"),
    (re.compile(r"\b(?:senior|sr\.?)\b", re.IGNORECASE), "senior"),
    (re.compile(r"\bstaff\b", re.IGNORECASE), "staff"),
    (re.compile(r"\bprincipal\b", re.IGNORECASE), "principal"),
    (re.compile(r"\blead\b", re.IGNORECASE), "lead"),
]


def floor_seniority(seniority: str | None, title: str | None) -> str | None:
    if seniority != "unknown" or not title:
        return seniority
    hits = {tok for pat, tok in _SENIORITY_TITLE_PATTERNS if pat.search(title)}
    if len(hits) == 1:          # exactly one ladder word; dual-level stays unknown
        return hits.pop()
    return seniority
