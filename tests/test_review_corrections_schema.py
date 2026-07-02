from tests.conftest import requires_db

EXPECTED_COLUMNS = {
    "user_id", "job_id", "verdict", "experience_match", "industry",
    "industry_subcategory", "confidence", "role_category", "seniority",
    "work_arrangement", "skills_score", "experience_score", "comp_score",
    "fit_score", "reasoning", "about", "pay_min", "pay_max", "pay_currency",
    "pay_period", "headcount", "red_flags", "skill_gaps", "benefits",
    "requirements", "model_snapshot", "note", "corrected_at",
}


@requires_db
def test_review_corrections_table_shape(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'review_corrections'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert EXPECTED_COLUMNS <= cols
