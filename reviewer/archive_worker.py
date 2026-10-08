"""Independent one-shot archive worker; supervisor enforces the 120-second deadline."""

import logging
import signal
import sys
from job_discovery.archive.export import export_once

log = logging.getLogger(__name__)


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
    try:
        result = export_once(None)
    except Exception as exc:
        # Provider exceptions may contain URL, credentials or payload. Log only type.
        log.warning(
            "archive export deferred; pending events retained (%s)", type(exc).__name__
        )
        return 1
    log.info(
        "archive export completed: acknowledged=%s",
        len(result.exact_event_ids) if result else 0,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
