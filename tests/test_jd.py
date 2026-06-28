from poller.jd import extract_description, html_to_text


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
