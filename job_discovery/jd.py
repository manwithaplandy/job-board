import html as _html
import re

_TAG_RE = re.compile(r"<[^>]+>")
_SPACES_RE = re.compile(r"[ \t]+")
_BLANKLINES_RE = re.compile(r"\n\s*\n\s*")


def html_to_text(s: str) -> str:
    """Convert (possibly entity-escaped) HTML to readable plain text."""
    unescaped = _html.unescape(s)          # &lt;div&gt; -> <div>
    no_tags = _TAG_RE.sub(" ", unescaped)  # strip tags
    text = _html.unescape(no_tags)         # decode entities inside text (&amp; -> &)
    text = _SPACES_RE.sub(" ", text)
    text = _BLANKLINES_RE.sub("\n\n", text)
    return text.strip()


def _lever(raw: dict) -> str | None:
    parts = [raw.get("descriptionPlain") or ""]
    for lst in raw.get("lists") or []:
        title = (lst.get("text") or "").strip()
        body = html_to_text(lst.get("content") or "")
        section = "\n".join(p for p in (title, body) if p)
        if section:
            parts.append(section)
    parts.append(raw.get("additionalPlain") or "")
    text = "\n\n".join(p for p in parts if p.strip())
    return text.strip() or None


def _workable(raw: dict) -> str | None:
    # Workable splits the JD across HTML `description` / `requirements` / `benefits`.
    parts = []
    for key in ("description", "requirements", "benefits"):
        body = html_to_text(raw.get(key) or "")
        if body:
            parts.append(body)
    return "\n\n".join(parts).strip() or None


def _smartrecruiters(raw: dict) -> str | None:
    # SmartRecruiters nests titled HTML sections under jobAd.sections.
    sections = (raw.get("jobAd") or {}).get("sections") or {}
    parts = []
    for key in ("companyDescription", "jobDescription", "qualifications",
                "additionalInformation"):
        sec = sections.get(key) or {}
        title = (sec.get("title") or "").strip()
        body = html_to_text(sec.get("text") or "")
        section = "\n".join(p for p in (title, body) if p)
        if section:
            parts.append(section)
    return "\n\n".join(parts).strip() or None


def _workday(raw: dict) -> str | None:
    desc = (raw.get("jobPostingInfo") or {}).get("jobDescription")
    text = html_to_text(desc) if desc else ""
    return text or None


def extract_description(ats: str, raw: dict) -> str | None:
    """Pull JD plain text from the stored `raw` payload. No HTTP — spec §5."""
    if not raw:
        return None
    if ats == "lever":
        return _lever(raw)
    if ats == "ashby":
        return (raw.get("descriptionPlain") or "").strip() or None
    if ats == "greenhouse":
        content = raw.get("content")
        text = html_to_text(content) if content else ""
        return text or None
    if ats == "workable":
        return _workable(raw)
    if ats == "smartrecruiters":
        return _smartrecruiters(raw)
    if ats == "workday":
        return _workday(raw)
    return None
