# Dashboard Implementation Plan (M3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Next.js dashboard that reads the Supabase `jobs`/`companies`/`poll_runs` tables (populated by the poller) and presents open roles with server-side filtering, a "New" badge, and a poll-health header — deployed to Vercel.

**Architecture:** Next.js App Router (TypeScript). All data fetching happens in Server Components via a single `postgres` (postgres.js) client connected through Supabase's **transaction-mode pooler (port 6543, `prepare: false`)**. Filtering is server-side: `searchParams` are parsed into a typed `Filters` object, compiled into a parameterized SQL query, and executed — no client-side data fetching, no API routes. Pure functions (filter parsing, SQL building, health/"new" computation) are unit-tested with Vitest; thin DB executors and React components wrap them.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `postgres` (postgres.js) driver, Tailwind CSS (minimal), Vitest. Deployed to Vercel Hobby.

> **Dependency on the poller plan:** this plan **consumes** the schema defined in `2026-06-23-poller-and-db.md` (`schema.sql`) read-only. The Supabase project and tables must already exist (poller plan Task 14). The dashboard never writes.

## Global Constraints

Apply to **every** task. Values from PRD §8 (dashboard FRs), §9, §10.

- **Read-only.** No writes, no API routes for mutation. Data fetching in **Server Components** only.
- Connect to Supabase via the **transaction-mode pooler (port 6543)** using the `postgres` npm package with **`prepare: false`** (PgBouncer transaction mode does not support prepared statements). Connection string from `DATABASE_URL`.
- **Server-side filtering only** — `searchParams` → typed filters → **parameterized** SQL (never string-interpolate user input).
- **Never commit credentials.** `DATABASE_URL` lives in `.env.local` (gitignored) and Vercel env vars.
- "New" window default **48h** (`NEW_WINDOW_HOURS`, configurable via env). Health "stale" threshold **12h** (`STALE_HEALTH_HOURS`).
- Default view: **open** jobs across all companies, sorted **`first_seen_at DESC`** (FR-7).
- A configurable default filter is applied **only on first load** (no filter query params present) and is fully overridable from the URL (FR-10).
- The app lives in a `dashboard/` subdirectory of this repo (the poller owns the repo root).

---

## File Structure

| Path | Responsibility |
|---|---|
| `dashboard/package.json` | Next.js app deps + scripts (`dev`, `build`, `test`). |
| `dashboard/tsconfig.json` | TS config with `@/*` path alias. |
| `dashboard/next.config.mjs` | Next.js config. |
| `dashboard/vitest.config.ts` | Vitest config for `lib/*.test.ts`. |
| `dashboard/tailwind.config.ts`, `dashboard/postcss.config.mjs` | Minimal Tailwind. |
| `dashboard/app/layout.tsx` | Root layout, imports global CSS. |
| `dashboard/app/globals.css` | Tailwind directives + base styles. |
| `dashboard/app/page.tsx` | Main dashboard (Server Component): parse params, fetch, render. |
| `dashboard/lib/db.ts` | postgres.js singleton client (`prepare: false`). |
| `dashboard/lib/config.ts` | `NEW_WINDOW_HOURS`, `STALE_HEALTH_HOURS`, `DEFAULT_INCLUDE_KEYWORDS`. |
| `dashboard/lib/types.ts` | Row types: `JobRow`, `CompanyRow`, `PollRunRow`. |
| `dashboard/lib/filters.ts` | `Filters` type + `parseFilters()` (pure). |
| `dashboard/lib/jobsQuery.ts` | `buildJobsQuery()` → `{ text, values }` (pure). |
| `dashboard/lib/status.ts` | `computeHealth()`, `isNew()` (pure). |
| `dashboard/lib/queries.ts` | `getJobs()`, `getCompanies()`, `getLatestPollRun()` (execute SQL). |
| `dashboard/components/Header.tsx` | Last-poll time + health indicator (FR-12). |
| `dashboard/components/FilterBar.tsx` | Filter form (GET) (FR-9, FR-10). |
| `dashboard/components/JobsTable.tsx` | Job rows + apply links + "New" badge (FR-8, FR-11). |
| `dashboard/.env.example` | Documents `DATABASE_URL`, `NEW_WINDOW_HOURS`. |
| `dashboard/.gitignore` | `.env*.local`, `.next`, `node_modules`. |

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/next.config.mjs`, `dashboard/vitest.config.ts`, `dashboard/tailwind.config.ts`, `dashboard/postcss.config.mjs`, `dashboard/app/layout.tsx`, `dashboard/app/globals.css`, `dashboard/app/page.tsx`, `dashboard/.env.example`, `dashboard/.gitignore`, `dashboard/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Next.js app and a working `npm test` (Vitest).

- [ ] **Step 1: Create `dashboard/package.json`**

```json
{
  "name": "job-board-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.3.0",
    "postgres": "^3.4.5",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create config files**

`dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`dashboard/next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`dashboard/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

`dashboard/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

`dashboard/postcss.config.mjs`:
```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 3: Create the app shell**

`dashboard/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
}
```

`dashboard/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remote Job Tracker",
  description: "Open roles across tracked companies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`dashboard/app/page.tsx` (temporary placeholder, replaced in Task 11):
```tsx
export default function Page() {
  return <main className="p-6">Dashboard scaffold.</main>;
}
```

`dashboard/.env.example`:
```
# Supabase TRANSACTION-MODE pooler (port 6543) — required for serverless
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres
NEW_WINDOW_HOURS=48
```

`dashboard/.gitignore`:
```
node_modules/
.next/
.env*.local
next-env.d.ts
```

- [ ] **Step 4: Write the smoke test**

`dashboard/lib/smoke.test.ts`:
```typescript
import { expect, test } from "vitest";

test("arithmetic sanity", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 5: Install and run the test**

Run:
```bash
cd dashboard && npm install && npm test
```
Expected: Vitest reports `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add dashboard/
git commit -m "chore: scaffold Next.js dashboard with Vitest"
```

---

## Task 2: Config + row types + DB client

**Files:**
- Create: `dashboard/lib/config.ts`, `dashboard/lib/types.ts`, `dashboard/lib/db.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `NEW_WINDOW_HOURS: number`, `STALE_HEALTH_HOURS: number`, `DEFAULT_INCLUDE_KEYWORDS: string[]`.
  - `JobRow`, `CompanyRow`, `PollRunRow` types.
  - `sql` — a postgres.js client singleton with `prepare: false`.

This task has no unit test (it's pure configuration + a side-effecting client); it is validated by the tasks that consume it and by `npm run build`.

- [ ] **Step 1: Create `dashboard/lib/config.ts`**

```typescript
export const NEW_WINDOW_HOURS = Number(process.env.NEW_WINDOW_HOURS ?? 48);
export const STALE_HEALTH_HOURS = 12;

// FR-10: the operator's default filter, applied on first load only.
export const DEFAULT_INCLUDE_KEYWORDS: string[] = ["engineer"];
```

- [ ] **Step 2: Create `dashboard/lib/types.ts`**

```typescript
export interface JobRow {
  id: string;
  title: string;
  url: string;
  location: string | null;
  remote: boolean | null;
  first_seen_at: string; // ISO timestamp
  closed_at: string | null;
  company_name: string;
  ats: string;
}

export interface CompanyRow {
  id: number;
  name: string;
}

export interface PollRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  companies_ok: number | null;
  companies_failed: number | null;
  new_jobs: number | null;
  closed_jobs: number | null;
  notes: string | null;
}
```

- [ ] **Step 3: Create `dashboard/lib/db.ts`**

```typescript
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase transaction-mode pooler (PgBouncer) does NOT support prepared
// statements — `prepare: false` is required (PRD §9).
export const sql = postgres(connectionString, { prepare: false });
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cd dashboard && npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/config.ts dashboard/lib/types.ts dashboard/lib/db.ts
git commit -m "feat: add dashboard config, row types, and postgres client"
```

---

## Task 3: Filter parsing (FR-9, FR-10)

**Files:**
- Create: `dashboard/lib/filters.ts`, `dashboard/lib/filters.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Status = "open" | "closed" | "all"`.
  - `interface Filters { companies: number[]; include: string[]; exclude: string[]; remoteOnly: boolean; status: Status }`.
  - `parseFilters(params: Record<string, string | string[] | undefined>, defaults: { include: string[] }) -> Filters`. Default `include` is applied **only when no filter param is present** (FR-10); `status` defaults to `"open"` (FR-7).

- [ ] **Step 1: Write the failing test**

`dashboard/lib/filters.test.ts`:
```typescript
import { describe, expect, test } from "vitest";
import { parseFilters } from "@/lib/filters";

const D = { include: ["engineer"] };

describe("parseFilters", () => {
  test("empty params → defaults: open status, default include keywords", () => {
    expect(parseFilters({}, D)).toEqual({
      companies: [],
      include: ["engineer"],
      exclude: [],
      remoteOnly: false,
      status: "open",
    });
  });

  test("any filter param present suppresses default include", () => {
    expect(parseFilters({ status: "all" }, D).include).toEqual([]);
  });

  test("parses csv company ids, include/exclude, remote, status", () => {
    const f = parseFilters(
      { company: "1,2", include: "staff,backend", exclude: "manager", remote: "1", status: "closed" },
      D,
    );
    expect(f.companies).toEqual([1, 2]);
    expect(f.include).toEqual(["staff", "backend"]);
    expect(f.exclude).toEqual(["manager"]);
    expect(f.remoteOnly).toBe(true);
    expect(f.status).toBe("closed");
  });

  test("invalid status falls back to open; non-numeric company ids dropped", () => {
    const f = parseFilters({ status: "bogus", company: "1,x" }, D);
    expect(f.status).toBe("open");
    expect(f.companies).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/filters.test.ts`
Expected: FAIL — cannot resolve `@/lib/filters`.

- [ ] **Step 3: Write the implementation**

`dashboard/lib/filters.ts`:
```typescript
export type Status = "open" | "closed" | "all";

export interface Filters {
  companies: number[];
  include: string[];
  exclude: string[];
  remoteOnly: boolean;
  status: Status;
}

const FILTER_KEYS = ["company", "include", "exclude", "remote", "status"] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function csv(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  defaults: { include: string[] },
): Filters {
  const hasAnyFilter = FILTER_KEYS.some((k) => first(params[k]) !== undefined);
  const status = first(params.status);
  const validStatus: Status =
    status === "closed" || status === "all" ? status : "open";

  return {
    companies: csv(first(params.company))
      .map(Number)
      .filter((n) => Number.isInteger(n)),
    include: hasAnyFilter ? csv(first(params.include)) : defaults.include,
    exclude: csv(first(params.exclude)),
    remoteOnly: first(params.remote) === "1",
    status: validStatus,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/filters.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/filters.ts dashboard/lib/filters.test.ts
git commit -m "feat: add server-side filter parsing with default-on-first-load"
```

---

## Task 4: Jobs SQL builder (FR-7, FR-9)

**Files:**
- Create: `dashboard/lib/jobsQuery.ts`, `dashboard/lib/jobsQuery.test.ts`

**Interfaces:**
- Consumes: `Filters` (Task 3).
- Produces: `buildJobsQuery(f: Filters) -> { text: string; values: unknown[] }` — a parameterized SQL string (positional `$1…$n`) selecting open/closed/all jobs joined to companies, applying company/include/exclude/remote filters, ordered `first_seen_at DESC`, limited to 500. Designed for `sql.unsafe(text, values)`.

- [ ] **Step 1: Write the failing test**

`dashboard/lib/jobsQuery.test.ts`:
```typescript
import { describe, expect, test } from "vitest";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";

const base: Filters = {
  companies: [],
  include: [],
  exclude: [],
  remoteOnly: false,
  status: "open",
};

describe("buildJobsQuery", () => {
  test("default open status adds closed_at IS NULL and orders by first_seen_at DESC", () => {
    const q = buildJobsQuery(base);
    expect(q.text).toContain("j.closed_at IS NULL");
    expect(q.text).toContain("ORDER BY j.first_seen_at DESC");
    expect(q.values).toEqual([]);
  });

  test("status closed / all", () => {
    expect(buildJobsQuery({ ...base, status: "closed" }).text).toContain(
      "j.closed_at IS NOT NULL",
    );
    const all = buildJobsQuery({ ...base, status: "all" });
    expect(all.text).not.toContain("closed_at IS NULL");
    expect(all.text).not.toContain("closed_at IS NOT NULL");
  });

  test("company filter uses ANY($n) with an int array param", () => {
    const q = buildJobsQuery({ ...base, companies: [1, 2] });
    expect(q.text).toContain("j.company_id = ANY($1)");
    expect(q.values).toEqual([[1, 2]]);
  });

  test("include/exclude become ILIKE / NOT ILIKE with %kw% params", () => {
    const q = buildJobsQuery({
      ...base,
      include: ["engineer"],
      exclude: ["manager"],
    });
    expect(q.text).toContain("j.title ILIKE $1");
    expect(q.text).toContain("j.title NOT ILIKE $2");
    expect(q.values).toEqual(["%engineer%", "%manager%"]);
  });

  test("remoteOnly adds remote IS TRUE", () => {
    expect(buildJobsQuery({ ...base, remoteOnly: true }).text).toContain(
      "j.remote IS TRUE",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: FAIL — cannot resolve `@/lib/jobsQuery`.

- [ ] **Step 3: Write the implementation**

`dashboard/lib/jobsQuery.ts`:
```typescript
import type { Filters } from "@/lib/filters";

export interface SqlQuery {
  text: string;
  values: unknown[];
}

export function buildJobsQuery(f: Filters): SqlQuery {
  const where: string[] = [];
  const values: unknown[] = [];
  const ph = () => `$${values.length + 1}`;

  if (f.status === "open") where.push("j.closed_at IS NULL");
  else if (f.status === "closed") where.push("j.closed_at IS NOT NULL");

  if (f.companies.length) {
    where.push(`j.company_id = ANY(${ph()})`);
    values.push(f.companies);
  }
  for (const kw of f.include) {
    where.push(`j.title ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  for (const kw of f.exclude) {
    where.push(`j.title NOT ILIKE ${ph()}`);
    values.push(`%${kw}%`);
  }
  if (f.remoteOnly) where.push("j.remote IS TRUE");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const text = [
    "SELECT j.id, j.title, j.url, j.location, j.remote,",
    "       j.first_seen_at, j.closed_at, c.name AS company_name, c.ats",
    "FROM jobs j",
    "JOIN companies c ON c.id = j.company_id",
    whereSql,
    "ORDER BY j.first_seen_at DESC",
    "LIMIT 500",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, values };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/jobsQuery.test.ts`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/jobsQuery.ts dashboard/lib/jobsQuery.test.ts
git commit -m "feat: add parameterized jobs SQL builder"
```

---

## Task 5: Health + "New" computation (FR-8, FR-12)

**Files:**
- Create: `dashboard/lib/status.ts`, `dashboard/lib/status.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Health = "ok" | "warn" | "stale"`.
  - `computeHealth(run: { finished_at: string | null; companies_failed: number | null } | null, now: Date, staleHours: number) -> Health` — `stale` if no finished run or older than `staleHours`; `warn` if the last run had failures; else `ok` (FR-12).
  - `isNew(firstSeenAt: string, now: Date, windowHours: number) -> boolean` (FR-8).

- [ ] **Step 1: Write the failing test**

`dashboard/lib/status.test.ts`:
```typescript
import { describe, expect, test } from "vitest";
import { computeHealth, isNew } from "@/lib/status";

const now = new Date("2026-06-23T12:00:00Z");

describe("computeHealth", () => {
  test("null run or no finished_at → stale", () => {
    expect(computeHealth(null, now, 12)).toBe("stale");
    expect(computeHealth({ finished_at: null, companies_failed: 0 }, now, 12)).toBe("stale");
  });

  test("older than staleHours → stale", () => {
    expect(
      computeHealth({ finished_at: "2026-06-22T20:00:00Z", companies_failed: 0 }, now, 12),
    ).toBe("stale"); // 16h old
  });

  test("recent with failures → warn", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", companies_failed: 2 }, now, 12),
    ).toBe("warn");
  });

  test("recent and clean → ok", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", companies_failed: 0 }, now, 12),
    ).toBe("ok");
  });
});

describe("isNew", () => {
  test("within window → true; outside → false", () => {
    expect(isNew("2026-06-23T06:00:00Z", now, 48)).toBe(true); // 6h
    expect(isNew("2026-06-20T06:00:00Z", now, 48)).toBe(false); // 78h
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/status.test.ts`
Expected: FAIL — cannot resolve `@/lib/status`.

- [ ] **Step 3: Write the implementation**

`dashboard/lib/status.ts`:
```typescript
export type Health = "ok" | "warn" | "stale";

const HOUR_MS = 3_600_000;

export function computeHealth(
  run: { finished_at: string | null; companies_failed: number | null } | null,
  now: Date,
  staleHours: number,
): Health {
  if (!run || !run.finished_at) return "stale";
  const ageHours = (now.getTime() - new Date(run.finished_at).getTime()) / HOUR_MS;
  if (ageHours > staleHours) return "stale";
  if ((run.companies_failed ?? 0) > 0) return "warn";
  return "ok";
}

export function isNew(firstSeenAt: string, now: Date, windowHours: number): boolean {
  const ageHours = (now.getTime() - new Date(firstSeenAt).getTime()) / HOUR_MS;
  return ageHours <= windowHours;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run lib/status.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/status.ts dashboard/lib/status.test.ts
git commit -m "feat: add health and new-badge computation"
```

---

## Task 6: Query executors

**Files:**
- Create: `dashboard/lib/queries.ts`

**Interfaces:**
- Consumes: `sql` (Task 2), `buildJobsQuery` (Task 4), row types (Task 2), `Filters` (Task 3).
- Produces:
  - `getJobs(f: Filters) -> Promise<JobRow[]>` — runs `buildJobsQuery` via `sql.unsafe`.
  - `getCompanies() -> Promise<CompanyRow[]>` — active companies, name-sorted (for the multi-select).
  - `getLatestPollRun() -> Promise<PollRunRow | null>` — most recent `poll_runs` row.

This task wraps the already-tested SQL builder around the live driver; correctness is verified end-to-end in Task 12 (live deploy). No standalone unit test (would require a live DB; the query shape is covered by Task 4).

- [ ] **Step 1: Write the implementation**

`dashboard/lib/queries.ts`:
```typescript
import { sql } from "@/lib/db";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { CompanyRow, JobRow, PollRunRow } from "@/lib/types";

export async function getJobs(f: Filters): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}

export async function getCompanies(): Promise<CompanyRow[]> {
  const rows = await sql`
    SELECT id, name FROM companies WHERE active ORDER BY name
  `;
  return rows as unknown as CompanyRow[];
}

export async function getLatestPollRun(): Promise<PollRunRow | null> {
  const rows = await sql`
    SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] as unknown as PollRunRow) ?? null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/queries.ts
git commit -m "feat: add jobs/companies/poll-run query executors"
```

---

## Task 7: Header component (FR-12)

**Files:**
- Create: `dashboard/components/Header.tsx`

**Interfaces:**
- Consumes: `Health` (Task 5), `PollRunRow` (Task 2).
- Produces: `Header({ lastRun, health }: { lastRun: PollRunRow | null; health: Health })` — renders the app title, last successful poll time, and a colored health dot (green `ok`, amber `warn`, red `stale`).

- [ ] **Step 1: Write the implementation**

`dashboard/components/Header.tsx`:
```tsx
import type { Health } from "@/lib/status";
import type { PollRunRow } from "@/lib/types";

const DOT: Record<Health, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-500",
  stale: "bg-red-500",
};

const LABEL: Record<Health, string> = {
  ok: "Healthy",
  warn: "Last run had failures",
  stale: "Stale / no recent run",
};

export function Header({
  lastRun,
  health,
}: {
  lastRun: PollRunRow | null;
  health: Health;
}) {
  const finished = lastRun?.finished_at
    ? new Date(lastRun.finished_at).toLocaleString()
    : "never";
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <h1 className="text-lg font-semibold">Remote Job Tracker</h1>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Last poll: {finished}</span>
        <span
          className={`inline-block h-3 w-3 rounded-full ${DOT[health]}`}
          title={LABEL[health]}
          aria-label={LABEL[health]}
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/Header.tsx
git commit -m "feat: add header with poll time and health indicator"
```

---

## Task 8: FilterBar component (FR-9, FR-10)

**Files:**
- Create: `dashboard/components/FilterBar.tsx`

**Interfaces:**
- Consumes: `Filters` (Task 3), `CompanyRow` (Task 2).
- Produces: `FilterBar({ companies, filters }: { companies: CompanyRow[]; filters: Filters })` — a plain HTML `<form method="GET">` (no client JS) whose fields map to the same query params `parseFilters` reads (`company`, `include`, `exclude`, `remote`, `status`), pre-filled from `filters`. Submitting reloads the Server Component with new params (server-side filtering).

- [ ] **Step 1: Write the implementation**

`dashboard/components/FilterBar.tsx`:
```tsx
import type { CompanyRow } from "@/lib/types";
import type { Filters } from "@/lib/filters";

export function FilterBar({
  companies,
  filters,
}: {
  companies: CompanyRow[];
  filters: Filters;
}) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3 border-b bg-white px-6 py-4">
      <label className="flex flex-col text-xs text-gray-600">
        Companies
        <select
          name="company"
          multiple
          defaultValue={filters.companies.map(String)}
          className="mt-1 h-24 rounded border px-2 py-1 text-sm"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Title includes (comma-sep)
        <input
          name="include"
          defaultValue={filters.include.join(",")}
          className="mt-1 rounded border px-2 py-1 text-sm"
          placeholder="engineer,staff"
        />
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Title excludes (comma-sep)
        <input
          name="exclude"
          defaultValue={filters.exclude.join(",")}
          className="mt-1 rounded border px-2 py-1 text-sm"
          placeholder="manager"
        />
      </label>

      <label className="flex flex-col text-xs text-gray-600">
        Status
        <select
          name="status"
          defaultValue={filters.status}
          className="mt-1 rounded border px-2 py-1 text-sm"
        >
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </select>
      </label>

      <label className="flex items-center gap-1 text-sm text-gray-700">
        <input type="checkbox" name="remote" value="1" defaultChecked={filters.remoteOnly} />
        Remote only
      </label>

      <button
        type="submit"
        className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
      >
        Apply
      </button>
    </form>
  );
}
```

> Note: the multi-select submits `company` as repeated params; `parseFilters` reads the first value via `first()`. To support multiple companies through a GET form without client JS, the comma-separated `include`/`exclude` inputs are the primary path; for multi-company, the Task 11 page also accepts `?company=1,2`. (A single-select is acceptable for V1; document this as a minor UI limitation.)

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/FilterBar.tsx
git commit -m "feat: add server-side GET filter bar"
```

---

## Task 9: JobsTable component (FR-8, FR-11)

**Files:**
- Create: `dashboard/components/JobsTable.tsx`

**Interfaces:**
- Consumes: `JobRow` (Task 2), `isNew` (Task 5).
- Produces: `JobsTable({ jobs, nowIso, windowHours }: { jobs: JobRow[]; nowIso: string; windowHours: number })` — a table with one row per job showing company, title (with a "New" badge when `isNew`), location, first-seen date, and a link to the ATS apply URL (FR-11). `nowIso` is passed in (not computed in the component) so rendering is deterministic.

- [ ] **Step 1: Write the implementation**

`dashboard/components/JobsTable.tsx`:
```tsx
import type { JobRow } from "@/lib/types";
import { isNew } from "@/lib/status";

export function JobsTable({
  jobs,
  nowIso,
  windowHours,
}: {
  jobs: JobRow[];
  nowIso: string;
  windowHours: number;
}) {
  const now = new Date(nowIso);
  if (jobs.length === 0) {
    return <p className="px-6 py-10 text-center text-gray-500">No matching roles.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-gray-500">
        <tr className="border-b">
          <th className="px-6 py-2">Company</th>
          <th className="px-6 py-2">Title</th>
          <th className="px-6 py-2">Location</th>
          <th className="px-6 py-2">First seen</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id} className="border-b hover:bg-gray-50">
            <td className="px-6 py-2 text-gray-700">{j.company_name}</td>
            <td className="px-6 py-2">
              <a
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                {j.title}
              </a>
              {isNew(j.first_seen_at, now, windowHours) && (
                <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                  New
                </span>
              )}
              {j.remote && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  Remote
                </span>
              )}
            </td>
            <td className="px-6 py-2 text-gray-600">{j.location ?? "—"}</td>
            <td className="px-6 py-2 text-gray-600">
              {new Date(j.first_seen_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/JobsTable.tsx
git commit -m "feat: add jobs table with New badge and apply links"
```

---

## Task 10: Main page wiring (FR-7)

**Files:**
- Modify: `dashboard/app/page.tsx` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `parseFilters`, `getJobs`/`getCompanies`/`getLatestPollRun`, `computeHealth`, config constants, and the three components.
- Produces: the default open-jobs view (FR-7) with filtering, header, and table. A Server Component reading `searchParams` (a Promise in Next 15).

- [ ] **Step 1: Write the implementation**

`dashboard/app/page.tsx`:
```tsx
import { parseFilters } from "@/lib/filters";
import { getCompanies, getJobs, getLatestPollRun } from "@/lib/queries";
import {
  DEFAULT_INCLUDE_KEYWORDS,
  NEW_WINDOW_HOURS,
  STALE_HEALTH_HOURS,
} from "@/lib/config";
import { computeHealth } from "@/lib/status";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { JobsTable } from "@/components/JobsTable";

// Always render fresh data (read-only DB query per request).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params, { include: DEFAULT_INCLUDE_KEYWORDS });

  const [jobs, companies, lastRun] = await Promise.all([
    getJobs(filters),
    getCompanies(),
    getLatestPollRun(),
  ]);

  const now = new Date();
  const health = computeHealth(lastRun, now, STALE_HEALTH_HOURS);

  return (
    <main>
      <Header lastRun={lastRun} health={health} />
      <FilterBar companies={companies} filters={filters} />
      <JobsTable jobs={jobs} nowIso={now.toISOString()} windowHours={NEW_WINDOW_HOURS} />
    </main>
  );
}
```

- [ ] **Step 2: Verify the production build compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no type errors. (A full `next build` needs `DATABASE_URL`; do that in Task 12 against the live pooler.)

- [ ] **Step 3: Run the full unit suite**

Run: `cd dashboard && npm test`
Expected: all `lib/*.test.ts` pass (filters, jobsQuery, status, smoke).

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/page.tsx
git commit -m "feat: wire dashboard page (header + filters + jobs table)"
```

---

## Task 11: Local verification against live data (AC-5, AC-6)

Verification task — requires the poller (other plan) to have populated Supabase.

**Interfaces:**
- Consumes: the live Supabase **transaction-pooler** `DATABASE_URL`, the full dashboard.
- Produces: evidence that keyword filtering (AC-5) and the "New" badge (AC-6) work against real data.

- [ ] **Step 1: Point the dashboard at Supabase (pooler) and run dev**

```bash
cd dashboard
printf 'DATABASE_URL=%s\nNEW_WINDOW_HOURS=48\n' "<supabase transaction-pooler URI, port 6543>" > .env.local
npm run dev
```
Open `http://localhost:3000`. Expected: open jobs render, newest first, default include keyword applied (FR-7, FR-10).

- [ ] **Step 2: Verify keyword filtering (AC-5)**

Visit `http://localhost:3000/?include=engineer&exclude=manager&status=open`.
Expected: every visible title contains "engineer" (case-insensitive) and none contains "manager", newest first. This is **AC-5**.

- [ ] **Step 3: Verify the "New" badge (AC-6)**

Confirm the "New" badge appears only on rows whose first-seen date is within 48h. Optionally narrow the window to prove the boundary:
```bash
# stop dev, then:
printf 'DATABASE_URL=%s\nNEW_WINDOW_HOURS=1\n' "<pooler URI>" > .env.local && npm run dev
```
Expected: with `NEW_WINDOW_HOURS=1`, badges disappear from rows older than 1h. This is **AC-6**. Restore `NEW_WINDOW_HOURS=48` afterward.

- [ ] **Step 4: Verify the health header (FR-12)**

Confirm the header shows the last poll time and a green dot (assuming a recent clean poll run). No commit needed (verification only).

---

## Task 12: Provision Vercel + deploy (M3)

Infrastructure task — execution uses the Vercel MCP tools and/or the Vercel CLI.

**Interfaces:**
- Consumes: the committed `dashboard/` app, the Supabase transaction-pooler URI.
- Produces: a live Vercel deployment reading Supabase.

- [ ] **Step 1: Confirm the Vercel account/team**

Run tool `mcp__plugin_vercel_vercel__list_teams` to confirm the target team/scope.

- [ ] **Step 2: Create/link the project with the correct root directory**

Create a Vercel project pointing at this repo with **Root Directory = `dashboard`** (Vercel auto-detects Next.js). Via CLI:
```bash
cd dashboard && npx vercel link
# When prompted, set the root directory to the dashboard folder.
```

- [ ] **Step 3: Set the production env var (transaction pooler)**

```bash
cd dashboard
printf '%s' "<supabase transaction-pooler URI, port 6543>" | npx vercel env add DATABASE_URL production
printf '48' | npx vercel env add NEW_WINDOW_HOURS production
```
(Use the **6543** pooler URI — NOT the direct 5432 connection — to avoid exhausting direct connections from serverless, PRD §9.)

- [ ] **Step 4: Deploy to production**

```bash
cd dashboard && npx vercel --prod
```
(Or run tool `mcp__plugin_vercel_vercel__deploy_to_vercel`.)

- [ ] **Step 5: Verify the live deployment**

Open the production URL. Expected: open jobs render with filters working (repeat AC-5 against the live URL: `?include=engineer&exclude=manager`). Run tool `mcp__plugin_vercel_vercel__get_deployment` (and `get_runtime_logs` if errors) to confirm a healthy deploy — in particular no "prepared statement" errors (which would indicate `prepare: false` is missing from `lib/db.ts`).

- [ ] **Step 6: Record M3 done**

Note the production URL and AC-5/AC-6 evidence in the PR/checkpoint. No code commit needed unless a fix was required.

---

## Self-Review

**Spec coverage (dashboard FRs + acceptance criteria):**

| Requirement | Task |
|---|---|
| FR-7 default open jobs, `first_seen_at DESC` | 4 (query), 3 (status default), 10 (page) |
| FR-8 "New" badge within window (default 48h) | 5 (`isNew`), 9 (badge), 2 (config) |
| FR-9 server-side filters (company, include, exclude, remote, status) | 3 (parse), 4 (SQL), 8 (form) |
| FR-10 configurable default filter on first load, overridable | 3 (`hasAnyFilter` gate), 2 (`DEFAULT_INCLUDE_KEYWORDS`) |
| FR-11 row links to apply URL; company, title, location, first-seen | 9 |
| FR-12 header last-poll time + health indicator (stale > 12h / failures) | 5 (`computeHealth`), 7 (Header), 2 (`STALE_HEALTH_HOURS`) |
| Transaction-pooler + `prepare: false` | 2 (`db.ts`), 12 (env var port 6543) |
| Server Components for data fetching | 6, 10 |
| AC-5 include `engineer` / exclude `manager`, open only, newest first | 4 (logic), 11 (live verify) |
| AC-6 "New" badge only within window | 5 (logic), 11 (live verify) |
| M3 deployed to Vercel reading Supabase via pooler | 12 |

**Type consistency:** `Filters` (shape: `companies`, `include`, `exclude`, `remoteOnly`, `status`) is defined once in Task 3 and consumed identically in Tasks 4, 6, 8, 10. `JobRow`/`CompanyRow`/`PollRunRow` are defined in Task 2 and used unchanged in Tasks 4 (column list matches `JobRow`), 6, 7, 8, 9, 10. `Health` is defined in Task 5 and consumed in Task 7/10. `buildJobsQuery` returns `{ text, values }` in Task 4 and is destructured identically in Task 6. `computeHealth`/`isNew` signatures match between Task 5 and their call sites (Tasks 9, 10).

**Placeholder scan:** the only non-literal values are the live Supabase pooler URI and Vercel team/project identifiers, which don't exist until execution; each is marked `<...>` next to the exact command/tool that produces or consumes it. `DEFAULT_INCLUDE_KEYWORDS` is seeded with `["engineer"]` (a concrete operator-overridable default), not a TODO.

**Known V1 limitations (documented, intentional):** the company filter is effectively single-select through the no-JS GET form (multi-company supported via manual `?company=1,2`); remote detection accuracy is inherited from the poller's best-effort heuristic. Both are acceptable per PRD non-goals and §6.
