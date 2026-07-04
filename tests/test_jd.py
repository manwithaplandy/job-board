import pytest

from job_discovery.jd import extract_description, html_to_text


def test_html_to_text_unescapes_strips_and_collapses():
    # Greenhouse content is HTML-entity-escaped HTML.
    raw = "&lt;div&gt;&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;We build A &amp; B&lt;/p&gt;&lt;/div&gt;"
    out = html_to_text(raw)
    assert "<" not in out and "&lt;" not in out
    assert "About" in out
    assert "A & B" in out  # entity inside text decoded


def test_extract_lever_combines_opening_lists_and_additional():
    raw = {
        "descriptionPlain": "About the role",
        "lists": [
            {"text": "Responsibilities", "content": "<ul><li>Build APIs</li></ul>"},
        ],
        "additionalPlain": "Benefits included",
    }
    out = extract_description("lever", raw)
    assert "About the role" in out
    assert "Responsibilities" in out
    assert "Build APIs" in out
    assert "Benefits included" in out


def test_extract_ashby_uses_description_plain():
    assert extract_description("ashby", {"descriptionPlain": "Full JD text"}) == "Full JD text"


def test_extract_greenhouse_strips_content_html():
    raw = {"content": "&lt;p&gt;Hello world&lt;/p&gt;"}
    assert extract_description("greenhouse", raw) == "Hello world"


def test_extract_returns_none_when_absent():
    assert extract_description("greenhouse", {}) is None
    assert extract_description("lever", {}) is None
    assert extract_description("ashby", {"descriptionPlain": ""}) is None
    assert extract_description("unknown", {"descriptionPlain": "x"}) is None


# ── A9: entity order fix ──────────────────────────────────────────────────────

def test_entities_inside_text_survive():
    """Entities embedded in real text (not marking HTML tags) must survive
    tag-stripping — they should appear as literal characters, not be lost."""
    # A common case: compensation ranges using < and > as comparison operators.
    # Before the fix: unescape first → &lt; becomes < → treated as a tag opener
    # and stripped. After the fix: strip tags first, then unescape.
    assert html_to_text("<p>comp: 100k &lt; base &gt; equity</p>") == "comp: 100k < base > equity"


def test_fully_entity_escaped_html_is_decoded():
    """Some ATSes send the entire HTML double-escaped. The pre-pass must detect
    that there are no literal '<' characters and unescape before tag-stripping."""
    raw = "&lt;div&gt;&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;We build A &amp; B&lt;/p&gt;&lt;/div&gt;"
    out = html_to_text(raw)
    assert "<" not in out and "&lt;" not in out
    assert "About" in out
    assert "A & B" in out


# ── workable / smartrecruiters / workday extractors + fallbacks ───────────────
# Only lever/ashby/greenhouse were covered above. These three ATSes feed the
# reviewer pipeline too; an extractor regression silently ships empty JDs.


def test_extract_workable_joins_three_parts_in_order():
    raw = {
        "description": "<p>About the role</p>",
        "requirements": "<ul><li>5y Python</li></ul>",
        "benefits": "<p>Health &amp; dental</p>",
    }
    out = extract_description("workable", raw)
    assert out is not None
    # Order preserved: description, then requirements, then benefits.
    assert out.index("About the role") < out.index("5y Python") < out.index("Health & dental")
    # Parts are separated by a blank line.
    assert "\n\n" in out
    assert "<" not in out


def test_extract_workable_skips_missing_and_empty_keys():
    raw = {"description": "<p>Only this</p>", "requirements": "", "benefits": None}
    out = extract_description("workable", raw)
    assert out == "Only this"


def test_extract_workable_all_empty_returns_none():
    assert extract_description("workable", {"description": "", "requirements": "", "benefits": ""}) is None
    assert extract_description("workable", {}) is None


def test_extract_smartrecruiters_composes_titled_sections_in_order():
    raw = {
        "jobAd": {
            "sections": {
                "companyDescription": {"title": "About Us", "text": "<p>We are Acme</p>"},
                "jobDescription": {"title": "The Role", "text": "<p>Build things</p>"},
                "qualifications": {"title": "You Have", "text": "<p>Skills &amp; grit</p>"},
                "additionalInformation": {"title": "Perks", "text": "<p>Remote</p>"},
            }
        }
    }
    out = extract_description("smartrecruiters", raw)
    assert out is not None
    # Fixed key order, each section rendered as "title\nbody".
    assert out.index("About Us") < out.index("The Role") < out.index("You Have") < out.index("Perks")
    assert "About Us\nWe are Acme" in out
    # Entity-escaped HTML in section text is decoded.
    assert "Skills & grit" in out


def test_extract_smartrecruiters_skips_empty_sections():
    raw = {
        "jobAd": {
            "sections": {
                "companyDescription": {"title": "", "text": ""},
                "jobDescription": {"title": "The Role", "text": "<p>Build</p>"},
            }
        }
    }
    out = extract_description("smartrecruiters", raw)
    assert out == "The Role\nBuild"


def test_extract_smartrecruiters_missing_jobad_or_sections_returns_none():
    assert extract_description("smartrecruiters", {}) is None
    assert extract_description("smartrecruiters", {"jobAd": {}}) is None
    assert extract_description("smartrecruiters", {"jobAd": {"sections": {}}}) is None


def test_extract_workday_pulls_nested_job_description():
    raw = {"jobPostingInfo": {"jobDescription": "<p>Hello &amp; welcome</p>"}}
    assert extract_description("workday", raw) == "Hello & welcome"


def test_extract_workday_missing_or_empty_returns_none():
    assert extract_description("workday", {}) is None
    assert extract_description("workday", {"jobPostingInfo": {}}) is None
    assert extract_description("workday", {"jobPostingInfo": {"jobDescription": ""}}) is None


def test_extract_unknown_ats_returns_none():
    assert extract_description("bamboohr", {"content": "x", "descriptionPlain": "y"}) is None


def test_extract_falsy_raw_returns_none_for_every_ats():
    # The `if not raw` guard: an empty/None-ish payload short-circuits to None
    # regardless of the ats, so a blank raw never reaches an extractor.
    for ats in ("lever", "ashby", "greenhouse", "workable", "smartrecruiters", "workday", "unknown"):
        assert extract_description(ats, {}) is None
