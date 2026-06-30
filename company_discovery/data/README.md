# Company Discovery dataset

A vendored, pinned snapshot of ATS board tokens — one JSON array of token strings
per supported ATS:
`greenhouse_companies.json`, `lever_companies.json`, `ashby_companies.json`,
`workable_companies.json`, `smartrecruiters_companies.json`, `workday_companies.json`.
These files are **committed** (not gitignored) so they ship with the Railway
Company Discovery cron build. All slug-style tokens are bare company slugs; Workday
tokens are `tenant:datacenter:site` triples (see `job_discovery/adapters/workday.py`).

Tokens are raw/firehose — unrecognized or dead ones get an `unknown`/`exclude`
verdict from the AI review and are never activated, so coverage is favored over
precision.

## Sources (all MIT-licensed)

| ATS | Source | File path | Snapshot count |
|-----|--------|-----------|----------------|
| greenhouse | [Feashliaa/job-board-aggregator](https://github.com/Feashliaa/job-board-aggregator) `data/` | `greenhouse_companies.json` | 8,333 |
| lever | Feashliaa/job-board-aggregator `data/` | `lever_companies.json` | 4,368 |
| ashby | Feashliaa/job-board-aggregator `data/` | `ashby_companies.json` | 3,161 |
| workable | [kalil0321/ats-scrapers](https://github.com/kalil0321/ats-scrapers) `ats-companies/workable.csv` (`slug` col) | `workable_companies.json` | 4,269 |
| smartrecruiters | kalil0321/ats-scrapers `ats-companies/smartrecruiters.csv` (`slug` col) | `smartrecruiters_companies.json` | 2,214 |
| workday | Feashliaa/job-board-aggregator `data/workday_companies.json` + kalil0321/ats-scrapers `ats-companies/workday.csv` | `workday_companies.json` | 7,065 (3,830 tenants) |

Greenhouse/Lever/Ashby + Workday(Feashliaa) come from Common-Crawl harvests;
Workable/SmartRecruiters (and the Workday supplement) come from `kalil0321/ats-scrapers`,
which API-probes each board. Snapshot taken 2026-06-30.

### Workday specifics

Workday's token is a `tenant:datacenter:site` triple, not a bare slug. Two cleanup
steps applied when building `workday_companies.json`:
- **Drop malformed Feashliaa rows** — ~47% of its entries are a harvester regex bug
  that puts the datacenter in the tenant slot (e.g. `wd5|wd1|site`); any entry whose
  tenant matches `^wd\d+$` is dropped.
- **Site-segment case** — Feashliaa lowercases all site segments. The Workday CxS
  `/wday/cxs/{tenant}/{site}/jobs` endpoint resolves the site path case-insensitively
  (live-verified), so the lowercased sites work. The `kalil0321` supplement (added
  only for tenants Feashliaa lacks) preserves the site's original case from its URL.

## To refresh

Re-download the source files listed above and rebuild:
- **greenhouse / lever / ashby**: copy the three `*_companies.json` files from
  `Feashliaa/job-board-aggregator` `data/` verbatim.
- **workable / smartrecruiters**: take the `slug` column from the matching
  `kalil0321/ats-scrapers` CSV → JSON array of lower-cased, deduped, sorted slugs.
- **workday**: from `Feashliaa` `workday_companies.json`, split each `|`-delimited
  triple, drop tenants matching `^wd\d+$`, join as `tenant:datacenter:site`; then
  union in `kalil0321` `workday.csv` (parse the `url` for the case-correct
  `tenant:datacenter:site`) for tenants Feashliaa lacks. Dedup and sort.

Override the directory at runtime with `DISCOVERY_DATASET_DIR`.
