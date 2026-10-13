"""One DB-only scheduled maintenance sweep, bounded by its parent supervisor."""
import logging
import signal
import sys

from job_discovery import db
from .claims import cancel_claim, claim_work
from .config import read_control
from .locks import enter_gate
from .maintenance import LEASE_SECONDS, sweep
from .types import SweepResult

log = logging.getLogger(__name__)


def run_maintenance_once(dsn: str | None) -> SweepResult:
    conn = claim = None
    result = SweepResult(0, 0, True, None)
    try:
        conn = db.connect(dsn)
        enter_gate(conn)
        control = read_control(conn)
        if not control.maintenance_enabled:
            conn.commit()
            return SweepResult(0, 0, False, None)
        # claim_work fences the previous expired/cancelled generation under the
        # global gate before recovery; no worker-supplied clock or lease bypass.
        claim = claim_work(conn, 'maintenance', 'singleton', LEASE_SECONDS)
        conn.commit()
        if claim is not None:
            result = sweep(conn, claim, dry_run=control.retirement_dry_run, scheduled=True)
    except Exception:
        log.exception('scheduled maintenance failed')
    finally:
        if conn is not None:
            try:
                conn.rollback()
                if claim is not None:
                    cancel_claim(conn, claim)
                    conn.commit()
            except Exception:
                log.exception('maintenance release failed; retained lease requires recovery')
                result = SweepResult(result.retired_rows, result.retired_bytes, True, result.cursor)
            finally:
                conn.close()
    return result


def main() -> int:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')

    def terminate(signum, _frame):
        # Allow finally to roll back and release normally; the parent kills a
        # blocked connection/process at its shared 30-second shutdown deadline.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)
    result = run_maintenance_once(None)
    log.info('scheduled maintenance result: %s', result)
    return int(result.blocked)


if __name__ == '__main__':
    sys.exit(main())
