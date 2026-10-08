"""Finite suspicious-empty diagnostics using stored public coordinates only."""
import logging
from contextlib import contextmanager
from time import monotonic

from .reconcile import _write

log = logging.getLogger(__name__)


@contextmanager
def _change(conn, source_id, claim, operational):
    if operational:
        from .operational import _receipt
        _receipt(conn, source_id, claim)
        yield
    else:
        with _write(conn, claim, "source_accounts"):
            yield


def schedule(conn, source_id, claim, *, operational=False):
    with _change(conn, source_id, claim, operational):
        conn.execute("""UPDATE source_accounts SET followup_due_at=clock_timestamp(),followup_status='pending'
          WHERE id=%s AND suspicious_empty_streak>=2 AND followup_due_at IS NULL
          AND (last_followup_at IS NULL OR last_followup_at<=clock_timestamp()-interval '24 hours')""", (source_id,))


def run(conn, source, claim, budget, *, operational=False):
    """Consume at most three remaining requests and the SAME board time budget.

    Persist the attempt before HTTP: interrupted/retried turns do not append
    queue rows or repeat a sample inside 24 hours. Live/unknown responses provide
    migration diagnostics; neither supplies inferred absence or mass closure.
    """
    from .demand import fetch_payload
    from .claims import renew_claim
    from job_discovery.adapters.completeness import source_budget

    if budget is None or budget[1] <= 0 or monotonic() >= budget[0]:
        return
    due = conn.execute("SELECT 1 FROM source_accounts WHERE id=%s AND followup_due_at<=clock_timestamp()", (source["id"],)).fetchone()
    if not due:
        conn.commit()
        return
    rows = conn.execute("""SELECT l.external_id FROM source_listings l JOIN jobs j ON j.id=l.job_id
      WHERE l.source_account_id=%s AND j.closed_at IS NULL ORDER BY l.external_id LIMIT %s""",
      (source["id"],min(3,budget[1]))).fetchall()
    with _change(conn, source["id"], claim, operational):
        conn.execute("""UPDATE source_accounts SET followup_due_at=NULL,last_followup_at=clock_timestamp(),
          followup_status='running' WHERE id=%s""", (source["id"],))
    conn.commit()
    log.warning("source %s action needed: repeated suspicious empty; migration review; representative exact checks=%s",
                source["id"],len(rows))
    live = 0
    def pulse():
        if operational:
            from .operational import _receipt
            _receipt(conn,source["id"],claim)
        else:
            renew_claim(conn,claim)
        conn.commit()
    with source_budget(max(0,budget[0]-monotonic()), min(3,budget[1]), pulse):
        for row in rows:
            if monotonic() >= budget[0]:
                break
            try:
                payload = fetch_payload({"ats":source["ats"],"public_board_ref":source["public_board_ref"],"external_id":row["external_id"]})
                live += payload is not None
            except Exception:
                # HTTP failure, missing URL, or malformed input is unknown.
                pass
    with _change(conn, source["id"], claim, operational):
        conn.execute("UPDATE source_accounts SET followup_status='migration_review' WHERE id=%s", (source["id"],))
    conn.commit()
    log.warning("source %s migration review remains required: representative live=%s; no absence inferred",source["id"],live)
