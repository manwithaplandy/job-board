from job_discovery import db
from job_discovery.models import Posting
from job_discovery.prune import prune_jobs
from tests.conftest import requires_db

USER = "33333333-3333-3333-3333-333333333333"


def _job_exists(conn, job_id):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM jobs WHERE id=%s", (job_id,))
        return cur.fetchone() is not None


def _description(conn, job_id):
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id=%s", (job_id,))
        row = cur.fetchone()
        return row["description"] if row else None


def _company(conn, token, active=True):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active) "
            "VALUES (%s,'lever',%s,%s) RETURNING id",
            (token, token, active),
        )
        return cur.fetchone()["id"]


def _job(conn, cid, ext, *, description="jd", closed_days=None):
    db.upsert_job(conn, cid, "lever", _token(conn, cid),
                  Posting(external_id=ext, title="Eng", url="u",
                          raw={"descriptionPlain": description} if description else {}))
    jid = f"lever:{_token(conn, cid)}:{ext}"
    if closed_days is not None:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE jobs SET closed_at = now() - make_interval(days => %s) WHERE id=%s",
                (closed_days, jid),
            )
    conn.commit()
    return jid


def _token(conn, cid):
    with conn.cursor() as cur:
        cur.execute("SELECT token FROM companies WHERE id=%s", (cid,))
        return cur.fetchone()["token"]


def _review(conn, jid, verdict=None, stage1="pass"):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, stage1_decision, verdict) "
            "VALUES (%s,%s,'v',%s,%s)",
            (USER, jid, stage1, verdict),
        )
    conn.commit()


@requires_db
def test_rule_a_drops_denied_descriptions_keeps_row(conn):
    cid = _company(conn, "acme")
    denied = _job(conn, cid, "1")
    _review(conn, denied, verdict="deny")
    gate = _job(conn, cid, "2")
    _review(conn, gate, verdict=None, stage1="reject")
    approved = _job(conn, cid, "3")
    _review(conn, approved, verdict="approve")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id, description FROM jobs ORDER BY id")
        desc = {r["id"]: r["description"] for r in cur.fetchall()}
        cur.execute("SELECT count(*) AS n FROM job_reviews")
        n_reviews = cur.fetchone()["n"]
    assert desc[denied] is None          # denied -> stripped
    assert desc[gate] is None            # gate-reject -> stripped
    assert desc[approved] == "jd"        # approved -> kept
    assert n_reviews == 3                # records preserved
    assert counts["denied_descriptions_dropped"] == 2


@requires_db
def test_rule_b_deletes_old_closed_unless_approved(conn):
    cid = _company(conn, "acme")
    old_closed = _job(conn, cid, "1", closed_days=40)
    old_closed_approved = _job(conn, cid, "2", closed_days=40)
    _review(conn, old_closed_approved, verdict="approve")
    recently_closed = _job(conn, cid, "3", closed_days=5)
    open_job = _job(conn, cid, "4")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM jobs ORDER BY id")
        ids = {r["id"] for r in cur.fetchall()}
    assert old_closed not in ids                 # deleted
    assert old_closed_approved in ids            # approved spared
    assert recently_closed in ids                # inside retention window
    assert open_job in ids
    assert counts["closed_deleted"] == 1


@requires_db
def test_rule_c_deletes_inactive_company_jobs_unless_approved(conn):
    inactive = _company(conn, "dead", active=False)
    j1 = _job(conn, inactive, "1")
    j2 = _job(conn, inactive, "2")
    _review(conn, j2, verdict="approve")

    counts = prune_jobs(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM jobs ORDER BY id")
        ids = {r["id"] for r in cur.fetchall()}
    assert j1 not in ids                  # inactive-company job deleted
    assert j2 in ids                      # approved spared
    assert counts["inactive_company_deleted"] == 1


@requires_db
def test_delete_cascades_to_reviews(conn):
    cid = _company(conn, "acme")
    j = _job(conn, cid, "1", closed_days=40)
    _review(conn, j, verdict="deny")
    prune_jobs(conn)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM job_reviews WHERE job_id=%s", (j,))
        assert cur.fetchone()["n"] == 0


# ── A1: guard tests ────────────────────────────────────────────────────────────

@requires_db
def test_delete_closed_spares_jobs_with_application_package(conn):
    cid = _company(conn, "guard1")
    job_id = _job(conn, cid, "x1", closed_days=40)
    _review(conn, job_id, verdict="deny")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO application_packages (user_id, job_id, status, applied_at)"
            " VALUES (%s, %s, 'applied', now())", (USER, job_id))
    conn.commit()
    prune_jobs(conn)
    assert _job_exists(conn, job_id)


@requires_db
def test_delete_closed_spares_jobs_with_correction(conn):
    cid = _company(conn, "guard2")
    job_id = _job(conn, cid, "x2", closed_days=40)
    _review(conn, job_id, verdict="deny")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_corrections (user_id, job_id, verdict) VALUES (%s, %s, 'approve')",
            (USER, job_id))
    conn.commit()
    prune_jobs(conn)
    assert _job_exists(conn, job_id)


@requires_db
def test_drop_denied_keeps_description_when_correction_approves(conn):
    cid = _company(conn, "guard3")
    job_id = _job(conn, cid, "x3", description="full JD")
    _review(conn, job_id, verdict="deny")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_corrections (user_id, job_id, verdict) VALUES (%s, %s, 'approve')",
            (USER, job_id))
    conn.commit()
    prune_jobs(conn)
    assert _description(conn, job_id) == "full JD"


@requires_db
def test_drop_denied_sets_pruned_flag(conn):
    cid = _company(conn, "guard4")
    job_id = _job(conn, cid, "x4", description="full JD")
    _review(conn, job_id, verdict="deny")
    prune_jobs(conn)
    assert _description(conn, job_id) is None
    with conn.cursor() as _cur:
        row = conn.execute("SELECT description_pruned FROM jobs WHERE id=%s", (job_id,)).fetchone()
        assert row["description_pruned"] is True
