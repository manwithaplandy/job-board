# Recoverable reconstruction checkpoints

All bundles contain complete Git history for `feature/lifecycle-recovery`.
They preserve source, approved requirements, tests, reports and sanitized review
evidence. They contain no environment files, production database exports or
credentials. Library IDs below are confirmed tool results; local version
attributes were applied after upload.

| Checkpoint | Accepted scope | Bundle branch tip | Confirmed Library ID |
| --- | --- | --- | --- |
| 00 | Recovered approved requirements and reconstruction setup | `51624db86ae9f1e31363a7ccce8479776f533fd6` | `libfile_3e9c3823515c8191aa66373a20a5c5c7` |
| 01 | Task 1 isolated PostgreSQL harness, frozen migration baseline, CI 17 parity, both independent review gates | `95669e3d4bb57c81f3b117add7c6352de260487e` | `libfile_857c7cc774e48191aa481f7028271350` |

Task 1 accepted source tip: `204eea6ac9be1e1fd3263708577d1483f26969fb`.
Final affected harness/migration/RLS verification: **86 passed, zero skipped**
on PostgreSQL **17.11** and **16.15**. Initial whole-suite **899 passed** on
each major predates the cleanup fixes and is not represented as a final rerun.
Requirements and security both approved after two scoped fix rounds.

Task 2 is active from `8d1e98424b08f076df736f962ec94f2bf5bd30b8`.
Tasks 2–13 and the final independent whole-branch review remain pending.
Production activation, destination setup, deployment, push and merge remain
unauthorized. Reconstruction continues; this file is not a completion claim.
