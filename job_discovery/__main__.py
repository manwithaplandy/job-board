import logging
import sys

from job_discovery.run import run


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    counts = run()
    # Exit 1 only when EVERY company failed and at least one was attempted.
    # Partial failures (some ok, some failed) are expected during normal ops
    # and must not alert on-call; the poll_runs notes field carries the detail.
    if counts["ok"] == 0 and counts["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
