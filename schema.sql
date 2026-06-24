CREATE TABLE companies (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby')),
  token   TEXT NOT NULL,
  active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (ats, token)
);

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,             -- '{ats}:{token}:{external_id}'
  company_id    INT NOT NULL REFERENCES companies(id),
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  location      TEXT,
  department    TEXT,
  remote        BOOLEAN,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
  raw           JSONB
);
CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;

CREATE TABLE poll_runs (
  id               SERIAL PRIMARY KEY,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  companies_ok     INT,
  companies_failed INT,
  new_jobs         INT,
  closed_jobs      INT,
  notes            TEXT
);
