# company_discovery/__main__.py
# `python -m company_discovery` now runs the always-on classification worker (Task 6).
# The legacy per-user cron pipeline (run.run) stays in-tree, unreferenced by the
# service, until the cleanup migration phase.
from company_discovery.worker import main

if __name__ == "__main__":
    main()
