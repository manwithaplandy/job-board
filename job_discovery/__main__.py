import logging
import signal
import sys

from job_discovery.run import run

# Includes startup, the 90-second maintenance turn and 300-second source turn.
POLL_HARD_SECONDS = 450


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # Terminate in the OS even if Python or adapter cleanup is blocked.
    # Connections close and PostgreSQL rolls back uncommitted transactions.
    signal.signal(signal.SIGALRM, signal.SIG_DFL)
    signal.alarm(POLL_HARD_SECONDS)
    try:
        counts = run(require_source_enabled=True)
    finally:
        signal.alarm(0)
    # Exit 1 only when EVERY company failed and at least one was attempted.
    # Partial failures (some ok, some failed) are expected during normal ops
    # and must not alert on-call; the poll_runs notes field carries the detail.
    if counts["ok"] == 0 and counts["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
