"""Task10 ordinary paired-transaction behavior, intentionally no deferred Task3 probes."""

import pytest
from job_discovery.archive import outbox
from job_discovery.lifecycle.claims import claim_work
from tests.conftest import requires_db


@requires_db
def test_flag_off_legacy_write_has_no_event(conn):
    conn.execute("INSERT INTO brands(name) VALUES('Legacy')")
    conn.commit()
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0


@requires_db
def test_bounded_current_baseline_pairs_rollback(conn):
    conn.execute("INSERT INTO brands(name) VALUES('Brand')")
    from tests.archive_helpers import activate_fixture

    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "baseline", 180)
    conn.commit()
    with pytest.raises(RuntimeError), conn.transaction():
        outbox.baseline_batch(conn, "brands", claim, limit=1)
        raise RuntimeError("discard work")
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0


@requires_db
def test_direct_mutation_requires_pair_and_revision_predecessor(conn):
    from tests.archive_helpers import seeded_events
    from job_discovery.archive.schema import event_id

    claim, refs = seeded_events(conn, 1)
    with (
        pytest.raises(Exception, match="requires exact transactional"),
        conn.transaction(),
    ):
        conn.execute("UPDATE brands SET name='Unpaired'")
    assert conn.execute("SELECT name FROM brands").fetchone()["name"] == "Brand 0"
    conn.execute("UPDATE brands SET name='Paired'")
    pair = outbox.flush_public_changes(conn, claim)
    conn.commit()
    event = conn.execute(
        "SELECT * FROM public_outbox WHERE event_id=%s", (pair[0].event_id,)
    ).fetchone()
    assert event["revision"] == 2 and event["predecessor_id"] == refs[0].event_id
    assert event["event_id"] == event_id("brands", refs[0].aggregate_id, 2)


@requires_db
def test_unchanged_poll_and_private_cache_do_not_emit(conn):
    from tests.test_lifecycle_reconcile import setup_source
    from tests.archive_helpers import activate_fixture

    setup_source(conn)
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "unchanged", 180)
    outbox.baseline_batch(conn, "jobs", claim)
    conn.commit()
    before = outbox.outbox_health(conn)["events"]
    conn.execute(
        "UPDATE jobs SET last_seen_at=clock_timestamp(),description_last_used_at=clock_timestamp()"
    )
    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()")
    assert outbox.flush_public_changes(conn, claim) == ()
    conn.commit()
    assert outbox.outbox_health(conn)["events"] == before


def test_budget_boundaries_and_critical_reserve():
    assert outbox.budget_allows(87499, 0, 1, False)
    assert not outbox.budget_allows(87500, 0, 1, False)
    assert outbox.budget_allows(87500, 112 * 1024**2, 1, True)
    assert outbox.budget_allows(99999, 128 * 1024**2 - 1, 1, True)
    assert not outbox.budget_allows(100000, 0, 1, True)
    assert not outbox.budget_allows(0, 112 * 1024**2, 1, False)
    assert not outbox.budget_allows(0, 128 * 1024**2, 1, True)
    assert outbox.HARD_EVENTS - outbox.ORDINARY_EVENTS == 12500
    assert outbox.HARD_BYTES - outbox.ORDINARY_BYTES == 16 * 1024**2


@requires_db
def test_pending_events_have_no_ttl_or_cascade_cleanup(conn):
    from tests.archive_helpers import seeded_events

    seeded_events(conn)
    with pytest.raises(Exception, match="immutable pending"), conn.transaction():
        conn.execute("DELETE FROM public_outbox")
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3


@requires_db
def test_identity_and_reconcile_mutators_pair_transactionally(conn):
    from tests.test_lifecycle_reconcile import setup_source
    from tests.archive_helpers import activate_fixture
    from tests.test_lifecycle_admission import admit
    from job_discovery.models import Posting
    from job_discovery.lifecycle import reconcile
    from job_discovery.lifecycle.types import Observation

    source = setup_source(conn)
    conn.commit()
    activate_fixture(conn)
    _, claim = admit(
        conn,
        source,
        [
            Posting(
                "0",
                "Updated",
                "https://example.test/job",
                raw={"descriptionPlain": "Public content"},
            )
        ],
    )
    enum = reconcile.begin_enumeration(conn, source["id"], claim)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
    reconcile.commit_sightings(
        conn, enum, [Observation("0", listing["id"], "removed", now)]
    )
    conn.commit()
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"]
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_outbox WHERE kind='closed'"
        ).fetchone()["n"]
        >= 1
    )
    types = {
        r["aggregate_type"]
        for r in conn.execute("SELECT aggregate_type FROM public_outbox")
    }
    assert {"jobs", "job_versions", "source_listings"} <= types


@requires_db
def test_listing_watermark_does_not_certify_unknown_version(conn):
    from tests.test_lifecycle_reconcile import setup_source
    from tests.archive_helpers import activate_fixture
    from job_discovery.lifecycle.maintenance import _version_batch
    from job_discovery.archive.batches import (
        claim_batch,
        seal_batch,
        persist_seal,
        ack_batch,
    )
    from job_discovery.archive.types import BatchLimits
    from tests.test_archive_batches import verified

    setup_source(conn)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    versions = []
    for revision in (1, 2):
        versions.append(
            conn.execute(
                """INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
          VALUES(%s,%s,%s,%s,'{"title":"Role","url":"https://example.test/job"}',clock_timestamp(),clock_timestamp()-interval '31 days') RETURNING id""",
                (listing["job_id"], listing["id"], revision, str(revision) * 64),
            ).fetchone()["id"]
        )
    conn.execute(
        "UPDATE source_listings SET current_version_id=%s,current_revision=2,archived_revision=2",
        (versions[1],),
    )
    conn.commit()
    assert _version_batch(conn, 100, True)[0] == 0
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "versions", 180)
    outbox.baseline_batch(conn, "job_versions", claim)
    conn.commit()
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert _version_batch(conn, 100, True)[0] == 1
    conn.commit()


@requires_db
def test_migration_reapplication_preserves_flags_and_existing_events(conn):
    from pathlib import Path
    from tests.archive_helpers import seeded_events

    claim, refs = seeded_events(conn, 1)
    conn.execute(Path("migrations/2026-10-03-04-public-outbox.sql").read_text())
    conn.execute(Path("migrations/2026-10-03-05-public-outbox-fix1.sql").read_text())
    conn.commit()
    assert {
        r["event_id"]
        for r in conn.execute("SELECT event_id FROM public_pending_events")
    } == {r.event_id for r in refs}


@requires_db
def test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup(conn):
    from uuid import uuid4

    owner = uuid4()
    company = conn.execute(
        "INSERT INTO companies(name,ats,token) VALUES('Legacy','lever','legacy') RETURNING id"
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES('legacy-job',%s,'1','Role','https://example.test/job','Legacy body')",
        (company,),
    )
    conn.execute(
        "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('legacy-job',%s,'1','Updated','https://example.test/job') ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title",
        (company,),
    )
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,'legacy-job','legacy','approve')",
        (owner,),
    )
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id,answers_snapshot) VALUES(%s,'legacy-job','{}')",
        (owner,),
    )
    conn.execute(
        "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,'legacy-job','prepare'),(%s,'legacy-job','resume')",
        (owner, owner),
    )
    conn.commit()
    assert (
        conn.execute("SELECT count(*) n FROM public_pending_events").fetchone()["n"]
        == 0
    )
    from tests.conftest import as_user

    with as_user(conn, owner):
        conn.execute(
            "UPDATE job_reviews SET human_override=true WHERE user_id=%s AND job_id='legacy-job'",
            (owner,),
        )
    conn.execute("DELETE FROM generation_jobs WHERE user_id=%s", (owner,))
    conn.execute("DELETE FROM application_packages WHERE user_id=%s", (owner,))
    conn.execute("DELETE FROM job_reviews WHERE user_id=%s", (owner,))
    conn.commit()
    assert (
        conn.execute("SELECT title FROM jobs WHERE id='legacy-job'").fetchone()["title"]
        == "Updated"
    )
