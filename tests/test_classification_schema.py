from tests.conftest import requires_db, as_user

U1 = "11111111-1111-1111-1111-111111111111"
U2 = "22222222-2222-2222-2222-222222222222"


@requires_db
def test_companies_classification_columns_exist(conn):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO companies (name, ats, token, industry, size, hq_country,
                                   classification_confidence, classification_source)
            VALUES ('a', 'greenhouse', 'a', 'software_internet', '51-200', 'US',
                    'high', 'job') RETURNING id
        """)
        assert cur.fetchone()["id"]


@requires_db
def test_size_check_rejects_bad_bucket(conn):
    import psycopg
    with conn.cursor() as cur:
        try:
            cur.execute("INSERT INTO companies (name, ats, token, size) "
                        "VALUES ('b','greenhouse','b','300ish')")
            assert False, "CHECK should have rejected"
        except psycopg.errors.CheckViolation:
            conn.rollback()


@requires_db
def test_classification_jobs_defaults(conn):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO classification_jobs (model, company_cap, selection_mode, use_serp)
            VALUES ('google/gemini-3.5-flash-lite', 500, 'unclassified', FALSE)
            RETURNING status, processed, actual_prompt_tokens
        """)
        row = cur.fetchone()
    assert row["status"] == "pending" and row["processed"] == 0
