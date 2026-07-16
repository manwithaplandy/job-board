"""DB-level proof of cross-tenant denial (spec top-risk #1).

These run against the SAME schema.sql the prod RLS migration mirrors, using the
exact `SET LOCAL ROLE authenticated` + set_config('request.jwt.claims', …) the
dashboard's withUserSql uses. They validate the policy semantics directly —
including the subtle anon-grant-without-policy behaviour that lets the public
board's job-detail LEFT JOIN return zero review rows instead of a hard denial.
"""
import uuid

import psycopg
import pytest

from tests.conftest import SCHEMA_SQL, as_user, requires_db

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _seed_two_users(conn):
    """A shared company + job, then a full set of owner-scoped rows for A and B."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','lever','acme') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, description) "
            "VALUES ('lever:acme:1', %s, '1', 'Engineer', 'https://x', 'jd')",
            (cid,),
        )
        for uid in (A, B):
            cur.execute(
                "INSERT INTO profiles (user_id, resume_text, profile_version) "
                "VALUES (%s, 'resume', 'v1')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict, fit_score) "
                "VALUES (%s, 'lever:acme:1', 'v1', 'approve', 80)",
                (uid,),
            )
            cur.execute(
                "INSERT INTO review_corrections (user_id, job_id, verdict) "
                "VALUES (%s, 'lever:acme:1', 'deny')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO company_reviews (user_id, company_id, company_profile_version, verdict) "
                "VALUES (%s, %s, 'v1', 'include')",
                (uid, cid),
            )
            cur.execute(
                "INSERT INTO application_packages (user_id, job_id, status) "
                "VALUES (%s, 'lever:acme:1', 'prepared')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO resume_scores (user_id, job_id, grounding, jd_relevance) "
                "VALUES (%s, 'lever:acme:1', 3, 4)",
                (uid,),
            )
            cur.execute(
                "INSERT INTO cover_letter_edits (user_id, job_id, edited_text) "
                "VALUES (%s, 'lever:acme:1', 'Dear Hiring Manager, (edited)')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO usage_counters (user_id, day, kind, n) "
                "VALUES (%s, now()::date, 'review', 5)",
                (uid,),
            )
    conn.commit()
    return cid


_OWNER_TABLES = [
    ("profiles", "user_id = %s"),
    ("job_reviews", "user_id = %s"),
    ("review_corrections", "user_id = %s"),
    ("company_reviews", "user_id = %s"),
    ("application_packages", "user_id = %s"),
    ("resume_scores", "user_id = %s"),
    ("cover_letter_edits", "user_id = %s"),
    ("usage_counters", "user_id = %s"),
]


@requires_db
def test_select_of_other_tenant_rows_returns_zero(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            for table, _ in _OWNER_TABLES:
                cur.execute(f"SELECT count(*)::int AS n FROM {table}")
                assert cur.fetchone()["n"] == 1, f"{table}: A should see only its own row"
                cur.execute(f"SELECT count(*)::int AS n FROM {table} WHERE user_id = %s", (B,))
                assert cur.fetchone()["n"] == 0, f"{table}: A must not see B's rows"


@requires_db
def test_update_delete_of_other_tenant_rows_affects_zero(conn):
    _cid = _seed_two_users(conn)
    # UPDATE/DELETE targeting B's rows affect 0 rows (RLS filters them out).
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("UPDATE profiles SET resume_text = 'hax' WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("UPDATE job_reviews SET verdict = 'deny' WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("DELETE FROM application_packages WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("DELETE FROM resume_scores WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("DELETE FROM cover_letter_edits WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
    # B's rows survived untouched (verify as service role).
    with conn.cursor() as cur:
        cur.execute("SELECT resume_text FROM profiles WHERE user_id = %s", (B,))
        assert cur.fetchone()["resume_text"] == "resume"
        cur.execute("SELECT count(*)::int AS n FROM application_packages WHERE user_id = %s", (B,))
        assert cur.fetchone()["n"] == 1


@requires_db
def test_insert_with_foreign_user_id_fails_with_check(conn):
    _seed_two_users(conn)
    # Each attempt to write a row owned by B must trip the WITH CHECK (42501).
    # (usage_counters is not here: it is SELECT-only for authenticated, so a write is
    # denied by the missing table privilege — see test_usage_counters_is_select_only.)
    for table, cols, vals in [
        ("profiles", "(user_id, profile_version)", "(%s, 'v2')"),
        ("job_reviews", "(user_id, job_id, profile_version)", "(%s, 'lever:acme:1', 'v2')"),
    ]:
        with as_user(conn, A) as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                with c.cursor() as cur:
                    cur.execute(f"INSERT INTO {table} {cols} VALUES {vals}", (B,))


@requires_db
def test_owner_full_crud_on_own_rows_succeeds(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("UPDATE profiles SET resume_text = 'mine' WHERE user_id = %s", (A,))
            assert cur.rowcount == 1
            cur.execute("UPDATE job_reviews SET verdict = 'deny' WHERE user_id = %s", (A,))
            assert cur.rowcount == 1
            cur.execute("DELETE FROM resume_scores WHERE user_id = %s AND job_id = 'lever:acme:1'", (A,))
            assert cur.rowcount == 1
            cur.execute("DELETE FROM cover_letter_edits WHERE user_id = %s AND job_id = 'lever:acme:1'", (A,))
            assert cur.rowcount == 1


@requires_db
def test_usage_counters_is_select_only_for_authenticated(conn):
    """Cost integrity (B-COST): a user may READ their own usage_counters (remaining
    budget) but must NOT write them — no INSERT/UPDATE/DELETE privilege — so they can't
    zero their daily review spend or monthly generation allowance via the Data API.
    Writes come only from the service role (reviewer/worker + dashboard chargeGenerations
    on serviceSql). Each write is denied at the GRANT layer (InsufficientPrivilege)."""
    _seed_two_users(conn)  # each user has a usage_counters row (kind='review', n=5)
    # SELECT of own counter works.
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT n FROM usage_counters WHERE user_id = %s", (A,))
            assert cur.fetchone()["n"] == 5
    # Every write to their OWN counter is denied (missing table privilege). One
    # error-raising statement per as_user block (it aborts the transaction).
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("UPDATE usage_counters SET n = 0 WHERE user_id = %s", (A,))
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("DELETE FROM usage_counters WHERE user_id = %s", (A,))
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute(
                    "INSERT INTO usage_counters (user_id, day, kind, n) "
                    "VALUES (%s, now()::date, 'resume', 0)",
                    (A,),
                )
    # The service role (session default) still writes freely.
    with conn.cursor() as cur:
        cur.execute("UPDATE usage_counters SET n = 0 WHERE user_id = %s", (A,))
        assert cur.rowcount == 1


C = "cccccccc-cccc-cccc-cccc-cccccccccccc"


@requires_db
def test_daily_review_cap_is_not_user_writable(conn):
    """Cost integrity (B-COST): profiles.daily_review_cap is operator-only. A user keeps
    full control of the rest of their profile (resume_text, model_*, …) but cannot raise
    their own review budget by writing daily_review_cap — neither via UPDATE nor by
    smuggling it into an INSERT. Column-level grants enforce this at the privilege layer;
    the service role (which the reviewer/admin use) is unaffected."""
    _seed_two_users(conn)
    # A user CAN update ordinary columns of their own profile.
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("UPDATE profiles SET resume_text = 'mine', model_stage2 = 'x' WHERE user_id = %s", (A,))
            assert cur.rowcount == 1
    # But UPDATE of daily_review_cap is denied (no column UPDATE privilege).
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("UPDATE profiles SET daily_review_cap = 100000 WHERE user_id = %s", (A,))
    # A brand-new user (C, no seeded profile) CAN insert their profile row...
    with as_user(conn, C) as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO profiles (user_id, resume_text, profile_version) VALUES (%s, 'r', 'v1')",
                (C,),
            )
            assert cur.rowcount == 1
    # ...but NOT with daily_review_cap set (no column INSERT privilege on that column).
    with as_user(conn, C) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute(
                    "INSERT INTO profiles (user_id, profile_version, daily_review_cap) "
                    "VALUES (%s, 'v1', 100000)",
                    (C,),
                )
    # The service role sets the operator override freely.
    with conn.cursor() as cur:
        cur.execute("UPDATE profiles SET daily_review_cap = 3 WHERE user_id = %s", (A,))
        assert cur.rowcount == 1
        cur.execute("SELECT daily_review_cap FROM profiles WHERE user_id = %s", (A,))
        assert cur.fetchone()["daily_review_cap"] == 3


@requires_db
def test_service_write_only_tables_deny_authenticated_dml(conn):
    """Systemic guard (B-COST root cause): the blanket REVOKE strips Supabase's default
    anon/authenticated DML on service-write / deny-all tables, so RLS is not the only
    gate. A user can READ their subscription + review_requests but cannot forge or edit
    them, and cannot touch the invite / ledger tables at all."""
    _seed_two_users(conn)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO subscriptions (user_id, status, plan) VALUES (%s, 'active', 'pro')", (A,))
    conn.commit()
    # subscriptions: owner SELECT ok, but no self-upgrade (no INSERT/UPDATE privilege).
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT plan FROM subscriptions WHERE user_id = %s", (A,))
            assert cur.fetchone()["plan"] == "pro"
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("UPDATE subscriptions SET plan = 'pro' WHERE user_id = %s", (A,))
    # review_requests: owner may INSERT (enqueue) but not UPDATE (worker-only) — covered
    # in test_billing_tables_are_owner_scoped; here assert the deny-all tables are sealed.
    for table in ("invite_codes", "invite_redemptions", "schema_migrations", "account_deletions"):
        with as_user(conn, A) as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                with c.cursor() as cur:
                    cur.execute(f"SELECT * FROM {table}")


@requires_db
def test_shared_reads_and_review_runs_scope(conn):
    _seed_two_users(conn)
    # Legacy (NULL) + A's + B's review_runs; A should see only its own + NULL.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_runs (user_id) VALUES (%s), (%s), (NULL)", (A, B))
    conn.commit()
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM jobs")
            assert cur.fetchone()["n"] == 1
            cur.execute("SELECT count(*)::int AS n FROM companies")
            assert cur.fetchone()["n"] == 1
            cur.execute("SELECT user_id FROM review_runs")
            seen = [r["user_id"] for r in cur.fetchall()]
            assert uuid.UUID(A) in seen
            assert None in seen
            assert uuid.UUID(B) not in seen


@requires_db
def test_authenticated_cannot_read_invite_codes(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("SELECT * FROM invite_codes")


@requires_db
def test_anon_board_reads_and_job_detail_shape(conn):
    _seed_two_users(conn)
    # The exact getJobReviewDetail shape for an anonymous viewer: LEFT JOIN the
    # review tables on user_id = NULL::uuid. anon has SELECT (no policy → zero rows),
    # so every review field is NULL and only the job columns are populated — and it
    # must NOT raise permission-denied.
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        cur.execute("SELECT count(*)::int AS n FROM jobs")
        assert cur.fetchone()["n"] == 1
        cur.execute("SELECT count(*)::int AS n FROM companies")
        assert cur.fetchone()["n"] == 1
        cur.execute(
            """
            SELECT j.description, j.url, r.verdict, rc.note
            FROM jobs j
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = NULL::uuid
            LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = NULL::uuid
            WHERE j.id = 'lever:acme:1'
            """
        )
        row = cur.fetchone()
        assert row["description"] == "jd"
        assert row["verdict"] is None and row["note"] is None
    conn.rollback()
    # anon must NOT be able to read profiles at all (no grant → permission denied).
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute("SELECT * FROM profiles")
    conn.rollback()


@requires_db
def test_billing_tables_are_owner_scoped(conn):
    with conn.cursor() as cur:
        for uid in (A, B):
            cur.execute("INSERT INTO subscriptions (user_id, status, plan) VALUES (%s, 'active', 'pro')", (uid,))
    conn.commit()
    # A sees only its own subscription and can enqueue only its own review request.
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM subscriptions")
            assert cur.fetchone()["n"] == 1
            cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (A,))
            assert cur.rowcount == 1
    # A cannot enqueue a request owned by B (WITH CHECK).
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (B,))
    # authenticated has NO update policy on review_requests — only the worker (service
    # role) transitions status.
    with conn.cursor() as cur:  # seed a running row as service role
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'running')", (A,))
    conn.commit()
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("UPDATE review_requests SET status = 'done' WHERE user_id = %s", (A,))


@requires_db
def test_local_config_does_not_bleed_after_transaction(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM profiles")
            assert cur.fetchone()["n"] == 1  # scoped to A
    # as_user rolled back → role + GUC reset. Service-level access is back.
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM profiles")
        assert cur.fetchone()["n"] == 2  # both users visible again
        cur.execute("SELECT current_setting('request.jwt.claims', true) AS c")
        assert cur.fetchone()["c"] in (None, "")


# ── Systemic RLS/policy guard (MINORS-GUARD) ──────────────────────────────────
# The DB — not app code — is the last line of tenant isolation, so the invariant is not
# "these specific queries deny cross-tenant access" (the tests above) but "EVERY table
# that stores a user_id is RLS-enabled AND carries the exact policy set the multi-tenant
# design requires." Driven off the LIVE catalog so a NEW user-scoped table shipped with
# RLS off / unclassified, or a policy dropped or widened to anon, fails RIGHT HERE.
#
# The contract mirrors the RLS migrations (2026-06-26-rls-deny-all-policies,
# 2026-07-03-rls-tenant-isolation, 2026-07-03-billing-review-requests): each table has a
# permissive deny-all `no_anon_access` (FOR ALL, role {public}) PLUS its owner/shared
# policies scoped to `authenticated`. Permissive policies OR together, so for anon the
# effective set is just the deny-all; for authenticated it is deny-all OR the owner rule.
# policyname -> (cmd, frozenset(roles)).
_DENY = ("ALL", frozenset({"public"}))
_OWNER_ALL = {
    "no_anon_access": _DENY,
    "owner_access": ("ALL", frozenset({"authenticated"})),
}
EXPECTED_RLS = {
    # Full owner CRUD (owner_access FOR ALL, USING/WITH CHECK = app_user_id()).
    "profiles": _OWNER_ALL,
    "job_reviews": _OWNER_ALL,
    "review_corrections": _OWNER_ALL,
    "company_reviews": _OWNER_ALL,
    "application_packages": _OWNER_ALL,
    "resume_scores": _OWNER_ALL,
    # Cover-letter edit overlay (2026-07-07-cover-letter-edits): owner CRUD; the
    # dashboard's saveCoverLetterEdit/deleteCoverLetterEdit actions are the only writers.
    "cover_letter_edits": _OWNER_ALL,
    "usage_counters": _OWNER_ALL,
    # Async-generation status rows (2026-07-05-generation-jobs): owner CRUD; the
    # dashboard's withUserSql create/settle/poll paths are the only writers.
    "generation_jobs": _OWNER_ALL,
    # Stripe mirror: owner may READ, never write (webhook/service role writes).
    "subscriptions": {
        "no_anon_access": _DENY,
        "owner_read": ("SELECT", frozenset({"authenticated"})),
    },
    # On-demand queue: owner reads + enqueues; only the worker transitions status.
    "review_requests": {
        "no_anon_access": _DENY,
        "owner_read": ("SELECT", frozenset({"authenticated"})),
        "owner_insert": ("INSERT", frozenset({"authenticated"})),
    },
    # Pipeline accounting: owner (or legacy NULL) may read; no owner write.
    "review_runs": {
        "no_anon_access": _DENY,
        "owner_or_legacy_read": ("SELECT", frozenset({"authenticated"})),
    },
    # Per-user invite budget (2026-07-13-user-invites): owner may READ their count;
    # all writes are service-role (dashboard/lib/invites.ts atomic spend).
    "invite_allowances": {
        "no_anon_access": _DENY,
        "owner_read": ("SELECT", frozenset({"authenticated"})),
    },
    # Service-role-only (no authenticated policy at all): deny-all is the whole contract.
    "invite_redemptions": {"no_anon_access": _DENY},
    "account_deletions": {"no_anon_access": _DENY},
}

# Policies whose USING/WITH CHECK must be owner-scoped through app_user_id() — a guard so
# an owner_* policy can't be silently rewritten to a `true` (all-rows) predicate.
_OWNER_SCOPED = {"owner_access", "owner_read", "owner_insert", "owner_or_legacy_read"}


@requires_db
def test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set(conn):
    with conn.cursor() as cur:
        # Discover every base table storing a user_id, with its RLS flag.
        cur.execute(
            """
            SELECT c.relname AS tbl, c.relrowsecurity AS rls
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
              AND EXISTS (
                SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = c.oid AND a.attname = 'user_id'
                  AND a.attnum > 0 AND NOT a.attisdropped
              )
            ORDER BY c.relname
            """
        )
        user_tables = {r["tbl"]: r["rls"] for r in cur.fetchall()}

    assert user_tables, "no user-scoped tables discovered — schema.sql failed to load?"

    # (1) Systemic: every user_id table has RLS ON and a declared contract. A new one
    # that slips in RLS-off or unclassified fails one of these — before it can leak.
    for tbl, rls in sorted(user_tables.items()):
        assert rls is True, f"{tbl} stores user_id but RLS is DISABLED"
        assert tbl in EXPECTED_RLS, (
            f"{tbl} stores user_id but has no declared RLS contract — add it to "
            f"EXPECTED_RLS (and the deletion/export lists) before shipping"
        )

    # (2) And the live policy set for each must be EXACTLY the declared contract, with
    # every owner_* policy still scoped to app_user_id() (not widened to all rows).
    with conn.cursor() as cur:
        for tbl, expected in sorted(EXPECTED_RLS.items()):
            assert tbl in user_tables, f"{tbl} lost its user_id column"
            cur.execute(
                "SELECT policyname, cmd, roles, qual, with_check FROM pg_policies "
                "WHERE schemaname = 'public' AND tablename = %s",
                (tbl,),
            )
            rows = cur.fetchall()
            got = {r["policyname"]: (r["cmd"], frozenset(r["roles"])) for r in rows}
            assert got == expected, f"{tbl} RLS policy set drifted: {got} != {expected}"
            for r in rows:
                if r["policyname"] in _OWNER_SCOPED:
                    predicate = f"{r['qual'] or ''} {r['with_check'] or ''}"
                    assert "app_user_id" in predicate, (
                        f"{tbl}.{r['policyname']} is not owner-scoped via app_user_id(): {predicate!r}"
                    )


# ── Systemic GRANT-contract guard (MINOR-6) ──────────────────────────────────
# RLS filters WHICH rows a role touches; the TABLE/COLUMN privilege is a separate, OUTER
# gate. B-COST was rooted in Supabase's default handing writes to `authenticated` on
# service-write tables. The RLS guard above proves policies; THIS proves the grant layer:
# the live anon/authenticated table privileges must EXACTLY equal the allowlist (so a
# deny-all/service-write table can't leak a write, and a new table can't slip in granted).
# Privilege sets are frozensets of the SQL privilege_type strings; profiles' INSERT/UPDATE
# are COLUMN-level (not in role_table_grants), so its table-level set is {SELECT, DELETE}.
_R = frozenset  # (anon_privs, authenticated_privs)
EXPECTED_GRANTS = {
    "jobs":                 (_R({"SELECT"}), _R({"SELECT"})),
    "companies":            (_R({"SELECT"}), _R({"SELECT"})),
    "poll_runs":            (_R(), _R({"SELECT"})),
    "discovery_runs":       (_R(), _R({"SELECT"})),
    "discovery_state":      (_R(), _R({"SELECT"})),
    "review_runs":          (_R(), _R({"SELECT"})),
    "job_reviews":          (_R({"SELECT"}), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "review_corrections":   (_R({"SELECT"}), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "company_reviews":      (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "application_packages": (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "resume_scores":        (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "cover_letter_edits":   (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "generation_jobs":      (_R(), _R({"SELECT", "INSERT", "UPDATE", "DELETE"})),
    "usage_counters":       (_R(), _R({"SELECT"})),               # SELECT-only (B-COST)
    "profiles":             (_R(), _R({"SELECT", "DELETE"})),     # INSERT/UPDATE are column-level
    "subscriptions":        (_R(), _R({"SELECT"})),               # webhook writes; owner reads
    "review_requests":      (_R(), _R({"SELECT", "INSERT"})),     # owner enqueues; worker updates
    "tier_settings":        (_R({"SELECT"}), _R({"SELECT"})),
    "job_questions":        (_R({"SELECT"}), _R({"SELECT"})),  # shared_read: anon + authenticated SELECT
    "invite_allowances":    (_R(), _R({"SELECT"})),           # owner reads own count
    "app_settings":         (_R({"SELECT"}), _R({"SELECT"})), # shared_read like tier_settings
    # Everything else (invite_codes, invite_redemptions, schema_migrations,
    # account_deletions, openrouter_usage_snapshots) gets NO anon/authenticated grant.
}


@requires_db
def test_grant_contract_matches_the_allowlist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
        all_tables = {r["tbl"] for r in cur.fetchall()}
        cur.execute(
            "SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants "
            "WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')"
        )
        got: dict[str, dict[str, set]] = {}
        for r in cur.fetchall():
            got.setdefault(r["table_name"], {}).setdefault(r["grantee"], set()).add(r["privilege_type"])

    assert all_tables, "no public tables discovered — schema.sql failed to load?"
    for tbl in sorted(all_tables):
        anon_expected, auth_expected = EXPECTED_GRANTS.get(tbl, (_R(), _R()))
        anon_got = frozenset(got.get(tbl, {}).get("anon", set()))
        auth_got = frozenset(got.get(tbl, {}).get("authenticated", set()))
        assert anon_got == anon_expected, f"{tbl}: anon grants {set(anon_got)} != {set(anon_expected)}"
        assert auth_got == auth_expected, (
            f"{tbl}: authenticated grants {set(auth_got)} != {set(auth_expected)}"
        )


@requires_db
def test_future_tables_are_deny_by_default(conn):
    """ALTER DEFAULT PRIVILEGES (minor 6): a NEWLY created public table must start with NO
    anon/authenticated privileges, so a future service-write / deny-all table can't ship
    writable-by-authenticated with RLS as the only gate (the B-COST root cause). The
    schema.sql mirror is asserted too, since on plain Postgres the probe passes trivially
    (there is no Supabase default to counter) — the source check is what guards the mirror."""
    assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES" in SCHEMA_SQL
    assert "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES" in SCHEMA_SQL
    with conn.cursor() as cur:
        cur.execute("CREATE TABLE public._defpriv_probe (id int)")
        cur.execute(
            "SELECT count(*)::int AS n FROM information_schema.role_table_grants "
            "WHERE table_name = '_defpriv_probe' AND grantee IN ('anon','authenticated')"
        )
        n = cur.fetchone()["n"]
        cur.execute("DROP TABLE public._defpriv_probe")
    assert n == 0, "a new table re-acquired anon/authenticated grants — default-privilege deny missing"


@requires_db
def test_app_user_id_has_pinned_search_path(conn):
    """The RLS resolver public.app_user_id() must not have a MUTABLE search_path (Supabase
    advisor function_search_path_mutable). schema.sql pins it to pg_catalog (mirrored by
    migrations/2026-07-05-app-user-id-search-path.sql) — assert the live function carries a
    search_path setting so the mirror can't silently regress."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public' AND p.proname = 'app_user_id'"
        )
        row = cur.fetchone()
    assert row is not None, "public.app_user_id() not found"
    cfg = row["proconfig"] or []
    assert any(c.startswith("search_path=") for c in cfg), (
        f"app_user_id() has a mutable search_path (proconfig={cfg}) — pin it"
    )
