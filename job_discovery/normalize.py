import re

_REMOTE_RE = re.compile(r"remote", re.IGNORECASE)


def detect_remote(location: str | None, explicit: bool | None = None) -> bool | None:
    """Best-effort remote heuristic (PRD §6).

    True if the ATS flag is True OR the location string matches /remote/i.
    False only if the ATS explicitly says non-remote and the location does not match.
    None when unknown.
    """
    if explicit is True:
        return True
    if location and _REMOTE_RE.search(location):
        return True
    if explicit is False:
        return False
    return None
