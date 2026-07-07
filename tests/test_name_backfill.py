"""Name-only backfill: per-ATS dispatch is unit-tested (no network); the scope
query + display_name-only write contract are validated behind requires_db."""
import company_discovery.name_backfill as nb
from tests.conftest import requires_db


def test_fetch_name_lever_uses_board_title(monkeypatch):
    monkeypatch.setattr(nb, "fetch_board_name", lambda ats, token: "PushPress")
    assert nb.fetch_name("lever", "pushpress") == "PushPress"


def test_fetch_name_greenhouse_uses_enricher_name_half(monkeypatch):
    monkeypatch.setattr(nb, "ENRICHERS",
                        {"greenhouse": lambda token: ("Acme Corp", "about text")})
    assert nb.fetch_name("greenhouse", "acme") == "Acme Corp"


def test_fetch_name_swallows_fetch_errors(monkeypatch):
    def boom(ats, token):
        raise RuntimeError("dead board")

    monkeypatch.setattr(nb, "fetch_board_name", boom)
    assert nb.fetch_name("ashby", "t") is None


def test_fetch_name_unsupported_ats():
    assert nb.fetch_name("workday", "t:wd1:site") is None


@requires_db
def test_scope_active_without_display_name_only(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('needsname','lever','needsname', TRUE, 'dataset'),"
            "('inactive','lever','inactive', FALSE, 'dataset'),"
            "('hasname','greenhouse','hasname', TRUE, 'dataset')"
        )
        cur.execute("UPDATE companies SET display_name='Has Name' WHERE token='hasname'")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(nb._SCOPE_SQL)
        rows = cur.fetchall()
    assert [r["token"] for r in rows] == ["needsname"]


@requires_db
def test_update_writes_display_name_only_and_respects_guard(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('acme','lever','acme', TRUE, 'dataset') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(nb._UPDATE_SQL, ("Acme Inc", cid))
        cur.execute("SELECT display_name, about, about_source, enriched_at "
                    "FROM companies WHERE id = %s", (cid,))
        row = cur.fetchone()
    assert row["display_name"] == "Acme Inc"
    # display_name ONLY: enrichment fields untouched -> no LLM re-review queued.
    assert row["about"] is None and row["about_source"] is None and row["enriched_at"] is None
    # Guard: a concurrent/prior name is never overwritten.
    with conn.cursor() as cur:
        cur.execute(nb._UPDATE_SQL, ("Other Name", cid))
        assert cur.rowcount == 0
