from job_discovery.prefs_backfill import remap, run
from tests.conftest import requires_db

U1 = "11111111-1111-1111-1111-111111111111"


def test_remap_expands_dedupes_and_appends_remote():
    mapping = {"Austin Texas": ["Austin, TX"],
               "NYC or Remote": ["New York City, NY", "Remote"]}
    assert remap(["Austin Texas", "Austin, TX", "NYC or Remote"], mapping) == \
        ["Remote", "Austin, TX", "New York City, NY"]


def test_remap_keeps_unmapped_entries_verbatim():
    assert remap(["Fooville"], {}) == ["Remote", "Fooville"]


def test_remap_is_idempotent():
    mapping = {"Austin Texas": ["Austin, TX"]}
    once = remap(["Austin Texas"], mapping)
    assert remap(once, mapping) == once


def test_remap_caps_at_100_without_dropping_remote():
    prefs = [f"City {i}" for i in range(150)]
    out = remap(prefs, {})
    assert len(out) == 100 and out[0] == "Remote"


@requires_db
def test_run_remaps_profiles(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            "preferred_locations) VALUES (%s, 'r', 'i', 'v1', %s)",
            (U1, ["Austin Texas", "Berlin, Germany"]))
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES ('Austin Texas', %s, '[]'::jsonb, 'rule')", (["Austin, TX"],))
    conn.commit()
    counts = run(conn)
    assert counts["updated"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT preferred_locations FROM profiles WHERE user_id = %s", (U1,))
        prefs = cur.fetchone()["preferred_locations"]
    assert prefs == ["Remote", "Austin, TX", "Berlin, Germany"]
    # second run is a no-op
    assert run(conn)["updated"] == 0
