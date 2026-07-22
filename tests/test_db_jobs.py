from job_discovery import db
from job_discovery.db import POLL_FAILURE_DEACTIVATE
from job_discovery.models import Posting
from tests.conftest import requires_db


def _seed_company(conn):
    db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        return cur.fetchone()["id"]


def _make_company(conn, token, *, source="dataset"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES (%s, 'lever', %s, TRUE, %s) RETURNING id",
            (token, token, source))
        return cur.fetchone()["id"]


# ── Dead-board deactivation: consecutive poll-failure tracking ────────────────

@requires_db
def test_record_poll_result_deactivates_dead_non_seed_board(conn):
    """POLL_FAILURE_DEACTIVATE consecutive failures flip a dataset company inactive,
    and the deactivation is reported (returns True) exactly once — on the crossing."""
    cid = _make_company(conn, "dead", source="dataset")
    conn.commit()
    returns = [db.record_poll_result(conn, cid, ok=False)
               for _ in range(POLL_FAILURE_DEACTIVATE)]
    conn.commit()
    assert returns == [False] * (POLL_FAILURE_DEACTIVATE - 1) + [True]
    with conn.cursor() as cur:
        cur.execute("SELECT active, poll_failures FROM companies WHERE id=%s", (cid,))
        row = cur.fetchone()
    assert row["active"] is False
    assert row["poll_failures"] == POLL_FAILURE_DEACTIVATE


@requires_db
def test_record_poll_result_never_deactivates_seed(conn):
    """A seed company keeps being polled forever — its failures accrue but it is
    never auto-deactivated."""
    cid = _make_company(conn, "seedco", source="seed")
    conn.commit()
    returns = [db.record_poll_result(conn, cid, ok=False)
               for _ in range(POLL_FAILURE_DEACTIVATE + 2)]
    conn.commit()
    assert not any(returns)
    with conn.cursor() as cur:
        cur.execute("SELECT active, poll_failures FROM companies WHERE id=%s", (cid,))
        row = cur.fetchone()
    assert row["active"] is True
    assert row["poll_failures"] == POLL_FAILURE_DEACTIVATE + 2


@requires_db
def test_record_poll_result_success_resets_counter(conn):
    """One successful poll clears the consecutive-failure streak."""
    cid = _make_company(conn, "flaky", source="dataset")
    conn.commit()
    for _ in range(3):
        db.record_poll_result(conn, cid, ok=False)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT poll_failures FROM companies WHERE id=%s", (cid,))
        assert cur.fetchone()["poll_failures"] == 3
    assert db.record_poll_result(conn, cid, ok=True) is False
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT active, poll_failures FROM companies WHERE id=%s", (cid,))
        row = cur.fetchone()
    assert row["poll_failures"] == 0
    assert row["active"] is True


@requires_db
def test_insert_then_idempotent_update(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x", location="Remote")

    assert db.upsert_job(conn, cid, "lever", "acme", p) is True
    with conn.cursor() as cur:
        cur.execute("SELECT id, first_seen_at FROM jobs WHERE id = 'lever:acme:1'")
        first = cur.fetchone()

    # Second sighting: not a new insert, first_seen_at unchanged (AC-1)
    assert db.upsert_job(conn, cid, "lever", "acme", p) is False
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, first_seen_at FROM jobs GROUP BY first_seen_at")
        again = cur.fetchone()
    assert again["n"] == 1
    assert again["first_seen_at"] == first["first_seen_at"]


@requires_db
def test_resighting_clears_closed_at(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x")
    db.upsert_job(conn, cid, "lever", "acme", p)
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = 'lever:acme:1'")
    conn.commit()

    db.upsert_job(conn, cid, "lever", "acme", p)  # reopened
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:acme:1'")
        assert cur.fetchone()["closed_at"] is None


@requires_db
def test_upsert_stores_extracted_description(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Eng", url="https://x",
                raw={"descriptionPlain": "Hello JD"})
    db.upsert_job(conn, cid, "lever", "acme", p)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] == "Hello JD"


@requires_db
def test_resight_does_not_overwrite_pruned_description(conn):
    cid = _seed_company(conn)
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Original"}))
    conn.commit()
    # Simulate the JD being pruned to NULL after a deny (A1 sets description_pruned=TRUE).
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET description=NULL, description_pruned=TRUE WHERE id='lever:acme:1'"
        )
    conn.commit()
    # Re-poll with a different JD must NOT restore description when pruned.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Rewritten"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] is None


# ── A5: enriched-field preservation + JD refill + no-op skip ─────────────────

@requires_db
def test_minimal_posting_does_not_null_enriched_fields(conn):
    """A re-poll with no location must not clobber an existing location."""
    cid = _seed_company(conn)
    # First upsert: full posting with location.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x", location="NYC"))
    conn.commit()
    # Second upsert: same id but location=None (minimal posting).
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x", location=None))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT location FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["location"] == "NYC"


@requires_db
def test_description_refills_when_never_captured(conn):
    """If description was never captured (NULL, description_pruned=FALSE), a re-poll
    that provides a description must fill it in."""
    cid = _seed_company(conn)
    # First upsert: no description in raw.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x", raw={}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description, description_pruned FROM jobs WHERE id='lever:acme:1'")
        row = cur.fetchone()
        assert row["description"] is None
        assert row["description_pruned"] is False  # not pruned, just never captured
    # Second upsert: now has a description.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "JD text"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] == "JD text"


@requires_db
def test_description_stays_null_when_pruned(conn):
    """If description_pruned=TRUE, a re-poll must NOT refill the description."""
    cid = _seed_company(conn)
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Original JD"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET description=NULL, description_pruned=TRUE WHERE id='lever:acme:1'"
        )
    conn.commit()
    # Re-poll with a JD must NOT refill.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "New JD"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] is None


@requires_db
def test_unchanged_row_is_not_rewritten(conn):
    """Upserting identical data must not update xmin (no actual write)."""
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Eng", url="https://x", location="NYC",
                raw={"descriptionPlain": "JD"})
    db.upsert_job(conn, cid, "lever", "acme", p)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT xmin FROM jobs WHERE id='lever:acme:1'")
        xmin_before = cur.fetchone()["xmin"]
    # Second identical upsert → no-op (WHERE filter skips the update).
    result = db.upsert_job(conn, cid, "lever", "acme", p)
    conn.commit()
    assert result is False  # not new
    with conn.cursor() as cur:
        cur.execute("SELECT xmin FROM jobs WHERE id='lever:acme:1'")
        xmin_after = cur.fetchone()["xmin"]
    assert xmin_before == xmin_after  # xmin unchanged → row was not rewritten


# ── A8: batch upsert ──────────────────────────────────────────────────────────

@requires_db
def test_upsert_jobs_batch_reports_new_count(conn):
    """upsert_jobs: batch of 3 (2 new, 1 existing-unchanged) returns new == 2."""
    cid = _seed_company(conn)
    # Pre-insert one existing job so it will be a no-op.
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="existing", title="Existing", url="https://x"))
    conn.commit()

    postings = [
        Posting(external_id="new1", title="New Job 1", url="https://a"),
        Posting(external_id="new2", title="New Job 2", url="https://b"),
        Posting(external_id="existing", title="Existing", url="https://x"),  # no-op
    ]
    new_count = db.upsert_jobs(conn, cid, "lever", "acme", postings)
    conn.commit()
    assert new_count == 2
