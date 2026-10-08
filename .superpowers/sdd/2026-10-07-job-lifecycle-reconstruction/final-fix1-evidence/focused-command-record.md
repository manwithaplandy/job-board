# Recorded final focused invocations

Working directory: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
All commands below route DB access through the owned disposable random-loopback harness.

`red-live-completion-order17.log` / `.exit`, test commit0751716 with unchanged prior productb4e1143:

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_final_fix1.py::test_live_demand_records_one_positive_and_defeats_older_absence -vv
```

The identical command produced `green-live-completion-order17.log` / `.exit` after the four-line paired Job reopen, subsequently committed as1cb3ab0. RED1 fail/1 pass2.40s; GREEN2 pass2.27s.

`green-detail-question-use17.log` / `.exit`, test commitcde25f7 and working product subsequently committedb4e1143:

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_final_fix1.py::test_delivered_detail_questions_apply_use_to_matching_capture_only -vv
```

`affected-retained-undo17.log` / `.exit`, test selection08c33ab and working product subsequently committedb4e1143:

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python tools/run_lifecycle_acceptance.py dashboard
```

The complete final sequential runner is `run-final-lanes.py`; `final-lanes.json` records actual executable paths, working directories, pins, UTC starts, wall durations and return codes. `pre-final-lanes.json` and `candidate-final-lanes.json` retain superseded full-run invocations including the deliberate candidate16 interruption. Earlier phase logs retain framework counts/timings/selected names; not every early shell redirection wrapper or uncommitted-source phase had a saved command/hash manifest. That evidence limit is stated in the report, never reconstructed as exact history.
