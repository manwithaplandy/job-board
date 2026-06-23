from poller.models import Posting
from poller.normalize import detect_remote


def test_posting_defaults():
    p = Posting(external_id="1", title="Engineer", url="https://x")
    assert p.location is None and p.department is None
    assert p.remote is None and p.raw == {}


def test_explicit_true_wins():
    assert detect_remote("New York", explicit=True) is True


def test_location_regex_when_no_flag():
    assert detect_remote("Remote - US", explicit=None) is True
    assert detect_remote("San Francisco", explicit=None) is None


def test_explicit_false_but_location_says_remote():
    # PRD: remote=True if flag OR location matches
    assert detect_remote("Remote", explicit=False) is True


def test_explicit_false_and_onsite_location():
    assert detect_remote("Berlin", explicit=False) is False
