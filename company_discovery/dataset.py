import json
from dataclasses import dataclass
from pathlib import Path

from job_discovery.adapters.workday import _parse_token

SUPPORTED_ATS = ("greenhouse", "lever", "ashby", "workable", "smartrecruiters", "workday")

# Slug-style tokens are case-insensitive and get lower-cased for dedup. Workday
# packs a case-sensitive `site` segment into its token (see
# job_discovery/adapters/workday.py), so its tokens are preserved verbatim.
_CASE_SENSITIVE_ATS = frozenset({"workday"})


@dataclass(frozen=True)
class Candidate:
    name: str
    ats: str
    token: str


def _parse_row(ats: str, row) -> Candidate | None:
    if isinstance(row, str):
        token = row.strip()
        name = token
    elif isinstance(row, dict):
        token = str(row.get("token") or row.get("slug") or "").strip()
        name = str(row.get("name") or token).strip()
    else:
        return None
    if not token:
        return None
    normalized = token if ats in _CASE_SENSITIVE_ATS else token.lower()
    if ats == "workday":
        # Workday tokens pack a 'tenant:datacenter:site' triple; drop rows whose
        # token is not a well-formed triple (matches this loader's skip-malformed
        # policy), reusing the adapter's parser rather than duplicating its logic.
        try:
            _parse_token(normalized)
        except ValueError:
            return None
    return Candidate(name=name or token, ats=ats, token=normalized)


def load_candidates(dataset_dir: Path) -> list[Candidate]:
    """Read `{ats}_companies.json` for each supported ATS; normalize + dedup.

    Tolerates missing files, bad JSON, and malformed rows (skips them).
    Each file is a JSON array of either bare token strings or
    `{"token"|"slug": str, "name"?: str}` objects.
    """
    seen: set[tuple[str, str]] = set()
    out: list[Candidate] = []
    for ats in SUPPORTED_ATS:
        path = Path(dataset_dir) / f"{ats}_companies.json"
        if not path.exists():
            continue
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            cand = _parse_row(ats, row)
            if cand is None:
                continue
            key = (cand.ats, cand.token)
            if key in seen:
                continue
            seen.add(key)
            out.append(cand)
    return out
