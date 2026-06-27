import json
from dataclasses import dataclass
from pathlib import Path

SUPPORTED_ATS = ("greenhouse", "lever", "ashby")


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
    return Candidate(name=name or token, ats=ats, token=token.lower())


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
            rows = json.loads(path.read_text())
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
