import hashlib


def compute_profile_version(resume_text: str | None, instructions: str | None) -> str:
    """sha256 of the resume+instructions, the verdict-invalidation key (spec §4)."""
    payload = (resume_text or "") + "\0" + (instructions or "")
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
