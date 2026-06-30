import json
from pathlib import Path

from job_discovery.adapters.workday import _parse_token

DEFAULT_TARGETS_PATH = Path(__file__).resolve().parent.parent / "targets.json"
_VALID_ATS = {"greenhouse", "lever", "ashby", "workable", "smartrecruiters", "workday"}


def load_targets(path: Path = DEFAULT_TARGETS_PATH) -> list[dict]:
    data = json.loads(Path(path).read_text())
    for t in data:
        if t.get("ats") not in _VALID_ATS:
            raise ValueError(f"Unknown ats {t.get('ats')!r} for target {t.get('name')!r}")
        for key in ("name", "ats", "token"):
            if not t.get(key):
                raise ValueError(f"Target missing {key!r}: {t!r}")
        if t["ats"] == "workday":
            # A Workday token packs a 'tenant:datacenter:site' triple; validate its
            # shape at load time (reusing the adapter's parser) so a malformed entry
            # is rejected here rather than silently failing every poll.
            _parse_token(t["token"])
    return data
