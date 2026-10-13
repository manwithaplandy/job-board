"""One bounded source-verification turn in the existing reviewer service.

The daily discovery command remains one-shot. This child only visits persisted
sources through the accepted due-source/operational paths; it performs no model
work, seed expansion or new infrastructure provisioning.
"""

import logging
import signal
import sys

from job_discovery import db
from .config import read_control
from .reconcile import verify_due_sources
from .maintenance import pre_admission_maintenance

log = logging.getLogger(__name__)
TURN_SECONDS = 300
MAX_BOARDS = 100


def run_source_once(dsn=None):
    conn = db.connect(dsn)
    try:
        enabled = read_control(conn).source_enabled
        conn.commit()
        if not enabled:
            return None
        # Same bounded prerequisite as daily admission; verification can still
        # use the accepted operational lane when ordinary storage is deferred.
        maintenance = pre_admission_maintenance(dsn)
        return verify_due_sources(
            conn, max_boards=MAX_BOARDS, seconds=TURN_SECONDS,
            admission_allowed=not maintenance.blocked,
        )
    finally:
        conn.close()


def main():
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )

    def terminate(signum, _frame):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        raise SystemExit(128 + signum)

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)
    result = run_source_once()
    log.info("source verification result: %s", result)
    return int(bool(result and result.get("storage_deferred")))


if __name__ == "__main__":
    sys.exit(main())
