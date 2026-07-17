from job_discovery import db as poller_db
from job_discovery.location_llm import ParsedLocation
from job_discovery.locations import resolve_new_locations, stamp_jobs
from job_discovery.models import Posting
from tests.conftest import requires_db


def _seed_job(conn, ext, location):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id=ext, title="Eng", url="https://x",
                                 location=location))
    conn.commit()
    return f"lever:acme:{ext}"


def _canonicals(conn, job_id):
    with conn.cursor() as cur:
        cur.execute("SELECT location_canonicals FROM jobs WHERE id = %s", (job_id,))
        return cur.fetchone()["location_canonicals"]


class FakeParseClient:
    """mapping: raw -> list[ParsedLocation]; raws absent from mapping get no answer."""
    def __init__(self, mapping=None, boom=False):
        self.mapping = mapping or {}
        self.boom = boom
        self.calls = 0

    async def parse_batch(self, raws):
        self.calls += 1
        if self.boom:
            raise RuntimeError("llm down")
        return {i: self.mapping[raw] for i, raw in enumerate(raws) if raw in self.mapping}


@requires_db
def test_rule_pass_inserts_and_stamps(conn):
    jid = _seed_job(conn, "1", "Austin Texas")
    counts = resolve_new_locations(conn, parse_client=FakeParseClient())
    assert counts["rule"] == 1 and counts["stamped"] == 1
    assert _canonicals(conn, jid) == ["Austin, TX"]
    with conn.cursor() as cur:
        cur.execute("SELECT canonicals, source FROM locations WHERE raw = 'Austin Texas'")
        row = cur.fetchone()
    assert row["canonicals"] == ["Austin, TX"] and row["source"] == "rule"


@requires_db
def test_multi_location_stamps_array(conn):
    jid = _seed_job(conn, "1", "NYC or Remote")
    resolve_new_locations(conn, parse_client=FakeParseClient())
    assert _canonicals(conn, jid) == ["New York City, NY", "Remote"]


@requires_db
def test_llm_pass_validates_against_gazetteer(conn):
    jid = _seed_job(conn, "1", "Greater Boston Area")
    fake = FakeParseClient({"Greater Boston Area": [
        ParsedLocation(city="Boston", state="MA", country="US"),
        ParsedLocation(city="Atlantisville", country="US"),  # hallucination -> dropped
    ]})
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["llm"] == 1
    assert _canonicals(conn, jid) == ["Boston, MA"]
    with conn.cursor() as cur:
        cur.execute("SELECT source FROM locations WHERE raw = 'Greater Boston Area'")
        assert cur.fetchone()["source"] == "llm"


@requires_db
def test_llm_empty_answer_becomes_unmappable(conn):
    jid = _seed_job(conn, "1", "Multiple Locations")
    fake = FakeParseClient({"Multiple Locations": []})
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["unmappable"] == 1
    assert _canonicals(conn, jid) == ["Multiple Locations"]
    with conn.cursor() as cur:
        cur.execute("SELECT canonicals, components FROM locations WHERE raw = 'Multiple Locations'")
        row = cur.fetchone()
    assert row["canonicals"] == ["Multiple Locations"]
    assert row["components"][0]["kind"] == "unmappable"


@requires_db
def test_llm_failure_leaves_raw_unmapped_and_does_not_raise(conn):
    jid = _seed_job(conn, "1", "Greater Boston Area")
    counts = resolve_new_locations(conn, parse_client=FakeParseClient(boom=True))
    assert counts["llm"] == 0 and counts["unmappable"] == 0
    assert _canonicals(conn, jid) is None  # COALESCE fallback keeps it matchable by raw
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM locations WHERE raw = 'Greater Boston Area'")
        assert cur.fetchone()["n"] == 0  # absent -> retried next run


@requires_db
def test_unanswered_index_left_unmapped(conn):
    _seed_job(conn, "1", "Greater Boston Area")
    fake = FakeParseClient(mapping={})  # answers nothing, but doesn't raise
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts == {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}


@requires_db
def test_manual_correction_propagates_on_restamp(conn):
    jid = _seed_job(conn, "1", "Austin Texas")
    resolve_new_locations(conn, parse_client=FakeParseClient())
    with conn.cursor() as cur:
        cur.execute("UPDATE locations SET canonicals = %s, source = 'manual' "
                    "WHERE raw = 'Austin Texas'", (["Austin, MN"],))
    conn.commit()
    assert stamp_jobs(conn) == 1
    conn.commit()
    assert _canonicals(conn, jid) == ["Austin, MN"]


@requires_db
def test_already_mapped_raws_not_reprocessed(conn):
    _seed_job(conn, "1", "Austin Texas")
    fake = FakeParseClient()
    resolve_new_locations(conn, parse_client=fake)
    counts = resolve_new_locations(conn, parse_client=fake)
    assert counts["rule"] == 0 and counts["stamped"] == 0
    assert fake.calls == 0  # nothing unresolved -> LLM never invoked
