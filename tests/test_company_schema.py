# tests/test_company_schema.py
from tests.conftest import requires_db


@requires_db
def test_company_discovery_schema(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name='companies'"
        )
        company_cols = {r["column_name"] for r in cur.fetchall()}
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name='profiles'"
        )
        profile_cols = {r["column_name"] for r in cur.fetchall()}
        cur.execute("SELECT to_regclass('public.company_reviews') AS t")
        has_reviews = cur.fetchone()["t"]
        cur.execute("SELECT to_regclass('public.discovery_runs') AS t")
        has_runs = cur.fetchone()["t"]
        cur.execute("SELECT id, halted_no_credits FROM discovery_state")
        state = cur.fetchone()

    assert {"discovery_source", "first_seen_at"} <= company_cols
    assert {"company_instructions", "company_profile_version", "model_company"} <= profile_cols
    assert has_reviews is not None and has_runs is not None
    assert state is not None and state["halted_no_credits"] is False  # seeded single row


@requires_db
def test_company_reviews_rls_enabled(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT relrowsecurity FROM pg_class WHERE relname = 'company_reviews'"
        )
        assert cur.fetchone()["relrowsecurity"] is True
