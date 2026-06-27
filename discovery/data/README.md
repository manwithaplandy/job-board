# Discovery dataset

A vendored, pinned snapshot of ATS board tokens — one JSON array of slug strings
per supported ATS: `greenhouse_companies.json`, `lever_companies.json`,
`ashby_companies.json`. These files are **committed** (not gitignored) so they ship
with the Railway discovery cron build.

**Source:** https://github.com/Feashliaa/job-board-aggregator (`data/` directory),
MIT-licensed — a Common-Crawl-harvested list of Greenhouse/Lever/Ashby company
slugs. Snapshot taken 2026-06-26: ~15,862 companies (greenhouse 8333, lever 4368,
ashby 3161). The slugs are raw/firehose — unrecognized ones get an `unknown`
verdict from the AI review and are excluded.

**To refresh:** re-download the three `*_companies.json` files from that repo's
`data/` directory and commit them. Override the directory with
`DISCOVERY_DATASET_DIR`.
