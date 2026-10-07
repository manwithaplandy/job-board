"""One transaction gate, then sorted job locks, before row/FK locks."""

from .config import LIFECYCLE_GATE_KEY


def enter_gate(conn) -> None:
    if (
        conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
        != "read committed"
    ):
        raise RuntimeError("lifecycle writes require read committed")
    conn.execute("SET LOCAL lock_timeout = '2s'")
    conn.execute("SET LOCAL statement_timeout = '5s'")
    conn.execute("SELECT pg_advisory_xact_lock(%s)", (LIFECYCLE_GATE_KEY,))


def lock_jobs(conn, job_ids) -> None:
    enter_gate(conn)
    for job_id in sorted(set(job_ids)):
        conn.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
            ("lifecycle:job:" + job_id,),
        )
