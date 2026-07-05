# Sign-up affordance + admin invite-code UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give anonymous visitors an obvious Sign in / Sign up path in the board header, and give admins a `/admin/invites` page to generate and list invite codes instead of hand-writing SQL.

**Architecture:** Feature 2 layers three thin pieces on the existing invite plumbing: two new `serviceSql` functions in the already-allowlisted `lib/invites.ts` (`createInvite`, `listInvites`), one admin-gated server action (`app/actions/invites.ts`), and a server-rendered `/admin/invites` page that mirrors `/admin/tenants` (same gate, same inline-style tokens) with a small client form. Feature 1 is a pure frontend change: the anon branch of the header CTA becomes two styled `<a href>` anchors and the now-dead anon redirect in `RolefitBoard` is removed. The two features are independent; Tasks 1–6 are Feature 2, Task 7 is Feature 1.

**Tech Stack:** Next.js App Router (server components + server actions), postgres.js via `serviceSql` (`@/lib/db`), Vitest 4 (`node` env default; jsdom via `// @vitest-environment jsdom` docblock — vitest 4 removed `environmentMatchGlobs`, see `dashboard/vitest.config.ts:12-15`) + `@testing-library/react` (no `user-event` dep — use `fireEvent`).

## Global Constraints

- **No DB migration.** `invite_codes` already has every column used here (`migrations/2026-07-03-multitenant-foundation.sql:51-58`: `code TEXT PK`, `note TEXT`, `max_uses INT DEFAULT 1`, `uses INT DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses)`, `expires_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT now()`).
- **Double-gate every privileged path:** the page calls `if (!isAdmin(claims)) notFound();` before any data fetch, AND the server action independently does `if (!isAdmin(await getUserClaims())) throw new Error("not authorized");` before any work. Never rely on one alone.
- **`serviceSql` only from admin-gated callers, only inside `lib/invites.ts`.** That file is already on the service-role allowlist (`lib/serviceRoleAllowlist.test.ts:18`); the allowlist is FILE-scoped, so new functions in it need no registration. The new action/page/components must NOT import `serviceSql` (the allowlist test would fail CI).
- **Codes:** CSPRNG (`crypto.getRandomValues`, never `Math.random`), uppercase `RF-XXXX-XXXX`, alphabet exactly `ABCDEFGHJKMNPQRSTVWXYZ23456789` (30 chars, no I/L/O/U/0/1).
- **`redeemInvite` semantics unchanged** (case-sensitive; generated codes are uppercase to match `FOUNDER-01`). No `created_by` column, no revoke/drill-down.
- **postgres.js rows come back snake_case.** House convention: a private snake_case `Row` interface + a hand mapper to camelCase (see `lib/tenantMetrics.ts:36-52` and `:104-129`). `createInvite`/`listInvites` map `max_uses → maxUses`, `expires_at → expiresAt`, `created_at → createdAt`.
- **Mock-based tests reusing existing harnesses:** extend `lib/invites.test.ts`'s `serviceSql` call-recording + staged-result mock verbatim; mirror `app/admin/tenants/page.test.ts` for the page gate; mirror the `vi.hoisted` mock style of `app/actions/signup.test.ts` for the action.
- **`ADMIN_EMAILS` gates admin routes** (fail-closed: unset ⇒ nobody is admin — `lib/admin.ts`). No public-header or `AccountMenu` link to `/admin/*` (unadvertised-route convention).
- **Action error contract (deliberate, documented deviation from the spec's literal `Promise<{ code: string }>` signature):** Next.js REDACTS thrown server-action error messages in production, so the spec's "throws a legible message the form can display" would show a generic error on prod. `createInviteAction` therefore returns a discriminated union `{ ok: true; code } | { ok: false; error }` — the same house pattern as `RedeemResult` (`lib/invites.ts:30`). The unauthorized gate still THROWS `"not authorized"` (strangers get no legible detail; mirrors `app/actions/companies.ts:50`).
- **Two tiny client components, not one:** the spec asks for a per-row copy button in the server-rendered table, which requires a client leaf. `CopyButton` (client) is shared by the table rows and the generator form; everything else on the page stays server-rendered.
- **Auth-page cross-links already exist** (`app/login/page.tsx` "Create account" → `/signup`; `app/signup/page.tsx` "Already have an account? Sign in" → `/login`). Do NOT touch those files.
- **Git:** never amend/rebase/force-push — always commit forward (repo `CLAUDE.md`). One conventional commit per task, from the repo root.
- **Never embed raw control/NUL bytes in test string literals** (use `\xNN` escapes if ever needed — not expected here).
- All commands below run from `dashboard/` unless the step says repo root.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `dashboard/app/actions/invites.ts` | `createInviteAction` server action: isAdmin gate → input validation → `createInvite` → result union |
| `dashboard/app/actions/invites.test.ts` | Gate ordering + validation + error-surfacing tests (node env, mocked `@/lib/auth` + `@/lib/invites`) |
| `dashboard/components/admin/AdminNav.tsx` | Shared `Tenants · Invites` sub-nav for the gated `/admin/*` pages (server-compatible, plain anchors) |
| `dashboard/components/admin/AdminNav.test.tsx` | jsdom: both links render with correct hrefs; active section gets `aria-current="page"` |
| `dashboard/components/admin/CopyButton.tsx` | Client leaf: copy a code to the clipboard, transient "Copied" feedback |
| `dashboard/components/admin/InviteGenerator.tsx` | Client form: fields → `createInviteAction` → show minted code + copy → `router.refresh()` |
| `dashboard/components/admin/InviteGenerator.test.tsx` | jsdom: fields render, submit wires parsed values, minted code/error display, CopyButton clipboard |
| `dashboard/app/admin/invites/page.tsx` | Server component: gate → `listInvites()` → AdminNav + generator card + codes table |
| `dashboard/app/admin/invites/page.test.ts` | Gate test mirroring `app/admin/tenants/page.test.ts` (4 cases) |

**Modified:**

| File | Change |
|---|---|
| `dashboard/lib/invites.ts` | ADD `InviteCode` type, `InviteCodeExistsError`, `generateInviteCode`, `createInvite` (Task 1), `listInvites` (Task 2). Existing exports untouched. |
| `dashboard/lib/invites.test.ts` | Extend with `generateInviteCode`/`createInvite`/`listInvites` describes, reusing the existing `serviceSql` mock harness |
| `dashboard/app/admin/tenants/page.tsx` | Render `<AdminNav active="tenants" />` inside the wrap div (Task 4) |
| `dashboard/components/rolefit/Header.tsx` | Anon CTA branch → two styled anchors (Sign in → `/login` secondary, Sign up → `/signup` primary); authed branch unchanged (Task 7) |
| `dashboard/components/rolefit/Header.test.tsx` | Replace the anon "Sign in button" assertion with the two-anchor assertion (Task 7) |
| `dashboard/components/rolefit/RolefitBoard.tsx` | Simplify the header `onOpenProfile` (lines 942-948) to `() => setProfileOpen(true)` — the anon redirect is dead (Task 7) |

**Explicitly NOT touched:** `app/login/page.tsx`, `app/signup/page.tsx` (cross-links already exist — do not re-add), `lib/serviceRoleAllowlist.test.ts` (no new `serviceSql` importer), `migrations/` (no migration), `components/ui/Button.tsx` (stays `<button>`-only), the JobDetail `onOpenProfile` at `RolefitBoard.tsx:1077` (already `() => setProfileOpen(true)`).

---

### Task 1: `InviteCode` type + `generateInviteCode` + `createInvite` in `lib/invites.ts`

**Files:**
- Modify: `dashboard/lib/invites.ts` (append after `linkInviteRedemption`, line 120)
- Test: `dashboard/lib/invites.test.ts` (extend: import line 26 + new helpers/describes after line 91)

**Interfaces:**
- Consumes: `serviceSql` from `@/lib/db` (already imported at `lib/invites.ts:1`).
- Produces (later tasks rely on these exact shapes):
  - `export type InviteCode = { code: string; note: string | null; maxUses: number; uses: number; expiresAt: Date | null; createdAt: Date }`
  - `export class InviteCodeExistsError extends Error` (message `"That code already exists."`)
  - `export function generateInviteCode(): string`
  - `export type CreateInviteOpts = { note?: string; maxUses?: number; expiresAt?: Date | null; code?: string }`
  - `export async function createInvite(opts?: CreateInviteOpts): Promise<InviteCode>`

- [ ] **Step 1: Write the failing tests**

  In `dashboard/lib/invites.test.ts`, change the import on line 26 from:

  ```ts
  import { redeemInvite, isInvitedUser } from "@/lib/invites";
  ```

  to:

  ```ts
  import {
    redeemInvite,
    isInvitedUser,
    createInvite,
    generateInviteCode,
    InviteCodeExistsError,
  } from "@/lib/invites";
  ```

  Then append at the end of the file (after the closing `});` of the `isInvitedUser` describe):

  ```ts
  // ── Admin invite minting (Feature 2) ────────────────────────────────────────

  const CODE_FORMAT = /^RF-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/;

  // A staged invite_codes row exactly as postgres.js returns it: snake_case.
  const inviteRow = (over: Record<string, unknown> = {}) => ({
    code: "RF-AAAA-AAAA",
    note: null,
    max_uses: 1,
    uses: 0,
    expires_at: null,
    created_at: new Date("2026-07-04T00:00:00Z"),
    ...over,
  });

  describe("generateInviteCode", () => {
    test("produces RF-XXXX-XXXX from the no-ambiguity alphabet, every time", () => {
      for (let i = 0; i < 200; i++) {
        expect(generateInviteCode()).toMatch(CODE_FORMAT);
      }
    });

    test("does not repeat across a small sample (CSPRNG sanity)", () => {
      const seen = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
      expect(seen.size).toBe(100);
    });
  });

  describe("createInvite", () => {
    test("auto-generates a well-formed code and inserts with defaults (max_uses=1, no expiry, no note)", async () => {
      stage([inviteRow()]);
      const created = await createInvite();
      expect(calls).toHaveLength(1);
      expect(text()).toContain("insert into invite_codes");
      expect(text()).toContain("returning");
      // Bound values, in template order: [code, note, maxUses, expiresAt].
      expect(calls[0].values[0]).toMatch(CODE_FORMAT);
      expect(calls[0].values[1]).toBeNull();
      expect(calls[0].values[2]).toBe(1);
      expect(calls[0].values[3]).toBeNull();
      // The snake_case row comes back mapped to the camelCase InviteCode shape.
      expect(created).toEqual({
        code: "RF-AAAA-AAAA",
        note: null,
        maxUses: 1,
        uses: 0,
        expiresAt: null,
        createdAt: new Date("2026-07-04T00:00:00Z"),
      });
    });

    test("respects note, maxUses, expiresAt, and a caller-supplied code", async () => {
      const expires = new Date("2026-08-01T00:00:00Z");
      stage([
        inviteRow({ code: "TEAM-2026", note: "for the team", max_uses: 5, expires_at: expires }),
      ]);
      const created = await createInvite({
        note: "for the team",
        maxUses: 5,
        expiresAt: expires,
        code: "TEAM-2026",
      });
      expect(calls[0].values).toEqual(["TEAM-2026", "for the team", 5, expires]);
      expect(created.code).toBe("TEAM-2026");
      expect(created.maxUses).toBe(5);
      expect(created.expiresAt).toEqual(expires);
    });

    test("retries auto-generation on a unique-PK collision with a FRESH code, then succeeds", async () => {
      const dup = Object.assign(new Error("duplicate key"), { code: "23505" });
      stage(dup, [inviteRow({ code: "RF-BBBB-BBBB" })]);
      const created = await createInvite();
      expect(calls).toHaveLength(2);
      expect(calls[0].values[0]).not.toBe(calls[1].values[0]); // regenerated, not re-tried
      expect(created.code).toBe("RF-BBBB-BBBB");
    });

    test("gives up after 5 colliding auto-generation attempts", async () => {
      const dup = () => Object.assign(new Error("duplicate key"), { code: "23505" });
      stage(dup(), dup(), dup(), dup(), dup());
      await expect(createInvite()).rejects.toThrow(/unique invite code/i);
      expect(calls).toHaveLength(5);
    });

    test("a custom-code collision throws InviteCodeExistsError without retrying", async () => {
      stage(Object.assign(new Error("duplicate key"), { code: "23505" }));
      await expect(createInvite({ code: "FOUNDER-01" })).rejects.toBeInstanceOf(
        InviteCodeExistsError,
      );
      expect(calls).toHaveLength(1);
    });

    test("a non-collision DB error propagates untouched (no silent retry)", async () => {
      stage(Object.assign(new Error("boom"), { code: "57014" }));
      await expect(createInvite()).rejects.toThrow("boom");
      expect(calls).toHaveLength(1);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run lib/invites.test.ts
  ```

  Expected: the WHOLE file errors with a missing-export failure (something like `SyntaxError: The requested module '@/lib/invites' does not provide an export named 'createInvite'`). The pre-existing `redeemInvite`/`isInvitedUser` tests report as failed-to-run too — that is the expected red state until Step 3.

- [ ] **Step 3: Write the implementation**

  Append to `dashboard/lib/invites.ts` (after `linkInviteRedemption`, end of file):

  ```ts
  // ── Admin invite minting (Feature 2: /admin/invites) ────────────────────────
  // createInvite/listInvites run on serviceSql under the SAME justification as the
  // header above: invite_codes has no authenticated RLS policy by design. They must
  // only ever be called from isAdmin-gated code (app/actions/invites.ts and
  // app/admin/invites/page.tsx) — never from an anon/tenant-reachable route.

  /** Camel-case shape of an invite_codes row (rows arrive snake_case; see toInviteCode). */
  export type InviteCode = {
    code: string;
    note: string | null;
    maxUses: number;
    uses: number;
    expiresAt: Date | null;
    createdAt: Date;
  };

  type InviteRow = {
    code: string;
    note: string | null;
    max_uses: number;
    uses: number;
    expires_at: Date | null;
    created_at: Date;
  };

  const toInviteCode = (r: InviteRow): InviteCode => ({
    code: r.code,
    note: r.note,
    maxUses: r.max_uses,
    uses: r.uses,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  });

  /** A caller-supplied custom code already exists — surfaced legibly by the action. */
  export class InviteCodeExistsError extends Error {
    constructor() {
      super("That code already exists.");
      this.name = "InviteCodeExistsError";
    }
  }

  // 30 chars, no I/L/O/U/0/1 — nothing a human can misread when relaying a code.
  const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const MAX_GENERATION_ATTEMPTS = 5;

  /**
   * CSPRNG invite code in the form RF-XXXX-XXXX (~30^8 ≈ 6.6e11 space). Rejection
   * sampling (bytes ≥ 240 are discarded; 240 = 8 × 30) removes the modulo bias a
   * plain `b % 30` over 0..255 would have. Exported for tests; treat as internal.
   */
  export function generateInviteCode(): string {
    const chars: string[] = [];
    while (chars.length < 8) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      for (const b of bytes) {
        if (chars.length === 8) break;
        if (b < 240) chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
      }
    }
    return `RF-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
  }

  export type CreateInviteOpts = {
    note?: string;
    maxUses?: number;
    expiresAt?: Date | null;
    code?: string;
  };

  /**
   * Insert one invite code and return the created row. Without `code`, an
   * RF-XXXX-XXXX code is generated; a 23505 PK collision (vanishingly rare)
   * regenerates and retries up to MAX_GENERATION_ATTEMPTS times. A caller-supplied
   * `code` is tried exactly once — a collision throws InviteCodeExistsError so the
   * action can surface it as user-legible copy instead of a raw PG error.
   */
  export async function createInvite(opts: CreateInviteOpts = {}): Promise<InviteCode> {
    const note = opts.note?.trim() ? opts.note.trim() : null;
    const maxUses = opts.maxUses ?? 1;
    const expiresAt = opts.expiresAt ?? null;
    const custom = opts.code?.trim() ? opts.code.trim() : undefined;

    const attempts = custom ? 1 : MAX_GENERATION_ATTEMPTS;
    for (let i = 0; i < attempts; i++) {
      const code = custom ?? generateInviteCode();
      try {
        const rows = (await serviceSql`
          INSERT INTO invite_codes (code, note, max_uses, expires_at)
          VALUES (${code}, ${note}, ${maxUses}, ${expiresAt})
          RETURNING code, note, max_uses, uses, expires_at, created_at
        `) as unknown as InviteRow[];
        return toInviteCode(rows[0]);
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err; // real failures propagate
        if (custom) throw new InviteCodeExistsError();
        // else: astronomically unlucky collision — loop regenerates a fresh code
      }
    }
    throw new Error("Couldn't generate a unique invite code after 5 attempts.");
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```
  cd dashboard && npx vitest run lib/invites.test.ts
  ```

  Expected: PASS — all pre-existing describes (`redeemInvite`, `isInvitedUser`) plus the new `generateInviteCode` (2 tests) and `createInvite` (6 tests).

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/lib/invites.ts dashboard/lib/invites.test.ts
  git commit -m "feat(invites): createInvite + CSPRNG RF-XXXX-XXXX generation in lib/invites"
  ```

---

### Task 2: `listInvites` in `lib/invites.ts`

**Files:**
- Modify: `dashboard/lib/invites.ts` (append after `createInvite`)
- Test: `dashboard/lib/invites.test.ts` (extend import + append a describe)

**Interfaces:**
- Consumes: `InviteRow`, `toInviteCode`, `serviceSql` (Task 1 / existing).
- Produces: `export async function listInvites(): Promise<InviteCode[]>` — consumed by `app/admin/invites/page.tsx` (Task 6).

- [ ] **Step 1: Write the failing test**

  In `dashboard/lib/invites.test.ts`, add `listInvites` to the `@/lib/invites` import (from Task 1 Step 1):

  ```ts
  import {
    redeemInvite,
    isInvitedUser,
    createInvite,
    generateInviteCode,
    InviteCodeExistsError,
    listInvites,
  } from "@/lib/invites";
  ```

  Append at the end of the file:

  ```ts
  describe("listInvites", () => {
    test("selects all codes newest-first and maps snake_case rows to InviteCode", async () => {
      stage([
        inviteRow({ code: "RF-CCCC-DDDD", created_at: new Date("2026-07-04T12:00:00Z") }),
        inviteRow({
          code: "FOUNDER-01",
          note: "seed",
          uses: 1,
          created_at: new Date("2026-07-03T12:00:00Z"),
        }),
      ]);
      const out = await listInvites();
      expect(calls).toHaveLength(1);
      expect(text()).toContain("from invite_codes");
      expect(text()).toContain("order by created_at desc");
      expect(out).toEqual([
        {
          code: "RF-CCCC-DDDD",
          note: null,
          maxUses: 1,
          uses: 0,
          expiresAt: null,
          createdAt: new Date("2026-07-04T12:00:00Z"),
        },
        {
          code: "FOUNDER-01",
          note: "seed",
          maxUses: 1,
          uses: 1,
          expiresAt: null,
          createdAt: new Date("2026-07-03T12:00:00Z"),
        },
      ]);
    });

    test("returns [] when no codes exist", async () => {
      stage([]);
      expect(await listInvites()).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run lib/invites.test.ts
  ```

  Expected: whole-file missing-export error for `listInvites` (same red-state shape as Task 1 Step 2).

- [ ] **Step 3: Write the implementation**

  Append to `dashboard/lib/invites.ts`:

  ```ts
  /** Every invite code, newest first, for the admin list view (`uses` IS the usage count — no join needed). */
  export async function listInvites(): Promise<InviteCode[]> {
    const rows = (await serviceSql`
      SELECT code, note, max_uses, uses, expires_at, created_at
      FROM invite_codes
      ORDER BY created_at DESC
    `) as unknown as InviteRow[];
    return rows.map(toInviteCode);
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```
  cd dashboard && npx vitest run lib/invites.test.ts
  ```

  Expected: PASS — all describes including the new `listInvites` (2 tests).

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/lib/invites.ts dashboard/lib/invites.test.ts
  git commit -m "feat(invites): listInvites for the admin invite list"
  ```

---

### Task 3: `createInviteAction` server action

**Files:**
- Create: `dashboard/app/actions/invites.ts`
- Test: `dashboard/app/actions/invites.test.ts` (node env)

**Interfaces:**
- Consumes: `createInvite(opts: CreateInviteOpts): Promise<InviteCode>` + `InviteCodeExistsError` (Task 1), `getUserClaims(): Promise<{ id: string; email: string | null } | null>` (`@/lib/auth:21`), `isAdmin(claims)` (`@/lib/admin`).
- Produces (consumed by `InviteGenerator`, Task 5):
  - `export type CreateInviteInput = { note?: string; maxUses?: number; expiresAt?: string | null; code?: string }`
  - `export type CreateInviteResult = { ok: true; code: string } | { ok: false; error: string }`
  - `export async function createInviteAction(input: CreateInviteInput): Promise<CreateInviteResult>`

- [ ] **Step 1: Write the failing test**

  Create `dashboard/app/actions/invites.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

  // Gate + validation contract for the invite-minting action. REAL isAdmin driven by
  // ADMIN_EMAILS (mirrors app/admin/tenants/page.test.ts); getUserClaims and
  // createInvite are mocked so no test touches auth or a DB.

  const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
  vi.mock("@/lib/auth", () => auth);

  const invites = vi.hoisted(() => {
    class InviteCodeExistsError extends Error {}
    return {
      InviteCodeExistsError,
      createInvite: vi.fn(async () => ({
        code: "RF-AAAA-AAAA",
        note: null as string | null,
        maxUses: 1,
        uses: 0,
        expiresAt: null as Date | null,
        createdAt: new Date("2026-07-04T00:00:00Z"),
      })),
    };
  });
  vi.mock("@/lib/invites", () => invites);

  const OLD = process.env.ADMIN_EMAILS;
  const { createInviteAction } = await import("@/app/actions/invites");

  const asAdmin = () =>
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });

  beforeEach(() => {
    auth.getUserClaims.mockReset();
    invites.createInvite.mockClear();
    process.env.ADMIN_EMAILS = "op@example.com";
  });
  afterEach(() => {
    if (OLD === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = OLD;
    vi.restoreAllMocks();
  });

  describe("createInviteAction gate (before any DB work)", () => {
    test("an authed NON-admin throws 'not authorized' and never reaches createInvite", async () => {
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
      await expect(createInviteAction({})).rejects.toThrow("not authorized");
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("anon (null claims) throws and never reaches createInvite", async () => {
      auth.getUserClaims.mockResolvedValue(null);
      await expect(createInviteAction({})).rejects.toThrow("not authorized");
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("fails closed: ADMIN_EMAILS unset rejects even a plausible email", async () => {
      delete process.env.ADMIN_EMAILS;
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
      await expect(createInviteAction({})).rejects.toThrow("not authorized");
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("an admin proceeds: defaults forwarded, minted code returned", async () => {
      asAdmin();
      const res = await createInviteAction({});
      expect(res).toEqual({ ok: true, code: "RF-AAAA-AAAA" });
      expect(invites.createInvite).toHaveBeenCalledTimes(1);
      expect(invites.createInvite).toHaveBeenCalledWith({
        note: undefined,
        maxUses: 1,
        expiresAt: null,
        code: undefined,
      });
    });
  });

  describe("createInviteAction validation (runs before the DB)", () => {
    test.each([0, -1, 1.5, 1001])(
      "maxUses=%s is rejected legibly without an insert",
      async (bad) => {
        asAdmin();
        const res = await createInviteAction({ maxUses: bad });
        expect(res).toEqual({
          ok: false,
          error: expect.stringContaining("between 1 and 1000"),
        });
        expect(invites.createInvite).not.toHaveBeenCalled();
      },
    );

    test("a past expiry is rejected without an insert", async () => {
      asAdmin();
      const res = await createInviteAction({ expiresAt: "2020-01-01" });
      expect(res).toEqual({ ok: false, error: expect.stringContaining("today or later") });
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("an unparseable expiry is rejected without an insert", async () => {
      asAdmin();
      const res = await createInviteAction({ expiresAt: "not-a-date" });
      expect(res).toEqual({ ok: false, error: expect.stringContaining("valid date") });
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("a custom code with an illegal charset is rejected without an insert", async () => {
      asAdmin();
      const res = await createInviteAction({ code: "bad code!" });
      expect(res.ok).toBe(false);
      expect(invites.createInvite).not.toHaveBeenCalled();
    });

    test("a lowercase custom code is uppercased before insert (redeem is case-sensitive)", async () => {
      asAdmin();
      await createInviteAction({ code: "team-2026" });
      expect(invites.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({ code: "TEAM-2026" }),
      );
    });

    test("a valid future expiry is forwarded as an end-of-day Date", async () => {
      asAdmin();
      await createInviteAction({ expiresAt: "2030-01-01" });
      expect(invites.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: new Date("2030-01-01T23:59:59.999Z") }),
      );
    });

    test("an expiry of today is accepted (interpreted as end of day)", async () => {
      asAdmin();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-04T09:00:00Z"));
      try {
        await createInviteAction({ expiresAt: "2026-07-04" });
        expect(invites.createInvite).toHaveBeenCalledWith(
          expect.objectContaining({ expiresAt: new Date("2026-07-04T23:59:59.999Z") }),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("createInviteAction error surfacing", () => {
    test("a custom-code collision comes back as a legible result, not a masked throw", async () => {
      asAdmin();
      invites.createInvite.mockRejectedValueOnce(
        new invites.InviteCodeExistsError("That code already exists."),
      );
      const res = await createInviteAction({ code: "FOUNDER-01" });
      expect(res).toEqual({ ok: false, error: "That code already exists." });
    });

    test("an unexpected failure returns a generic message (no internals leaked)", async () => {
      asAdmin();
      vi.spyOn(console, "error").mockImplementation(() => {});
      invites.createInvite.mockRejectedValueOnce(new Error("connection refused"));
      const res = await createInviteAction({});
      expect(res).toEqual({
        ok: false,
        error: "Couldn't create the invite. Please try again.",
      });
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run app/actions/invites.test.ts
  ```

  Expected: fails at the `await import("@/app/actions/invites")` line — `Failed to load ... app/actions/invites` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

  Create `dashboard/app/actions/invites.ts`:

  ```ts
  "use server";

  import { getUserClaims } from "@/lib/auth";
  import { isAdmin } from "@/lib/admin";
  import { createInvite, InviteCodeExistsError } from "@/lib/invites";

  // Admin-only invite minting (Feature 2). SECURITY: this action is independently
  // reachable regardless of the /admin/invites page gate, so it re-gates on isAdmin
  // FIRST — before validation, before any DB work (mirrors app/actions/companies.ts).
  // It deliberately does NOT import serviceSql: all privileged SQL stays inside
  // lib/invites.ts (the serviceRoleAllowlist file).
  //
  // ERROR CONTRACT: validation/collision failures return { ok: false, error } rather
  // than throwing — Next.js redacts thrown server-action messages in production, so a
  // thrown "Max uses must be…" would reach the form as a useless generic error. The
  // result union mirrors the RedeemResult house pattern (lib/invites.ts). The
  // unauthorized case still THROWS: strangers get no legible detail by design.

  // Custom codes: 4-40 chars of A-Z / 0-9 / hyphen, starting and ending alphanumeric
  // (covers the FOUNDER-01 and RF-XXXX-XXXX shapes). Input is uppercased first —
  // redeemInvite is case-sensitive and every real code is uppercase.
  const CUSTOM_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,38}[A-Z0-9]$/;

  export type CreateInviteInput = {
    note?: string;
    // From the form's <input type="number"> via Number(...) — validated to an int in 1..1000.
    maxUses?: number;
    // From the form's <input type="date"> (YYYY-MM-DD) — interpreted as end of that day; must be today or later.
    expiresAt?: string | null;
    code?: string;
  };

  export type CreateInviteResult =
    | { ok: true; code: string }
    | { ok: false; error: string };

  export async function createInviteAction(
    input: CreateInviteInput,
  ): Promise<CreateInviteResult> {
    if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

    const maxUses = input.maxUses ?? 1;
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) {
      return { ok: false, error: "Max uses must be a whole number between 1 and 1000." };
    }

    let expiresAt: Date | null = null;
    if (input.expiresAt) {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: "Expiry must be a valid date." };
      }
      // A date-only value (YYYY-MM-DD) parses to UTC midnight; treat it as the END of
      // that day so an expiry of "today" stays valid through the whole day rather than
      // being rejected as already past.
      parsed.setUTCHours(23, 59, 59, 999);
      if (parsed.getTime() <= Date.now()) {
        return { ok: false, error: "Expiry must be today or later." };
      }
      expiresAt = parsed;
    }

    let code: string | undefined;
    if (input.code?.trim()) {
      code = input.code.trim().toUpperCase();
      if (!CUSTOM_CODE_RE.test(code)) {
        return {
          ok: false,
          error: "Custom codes must be 4-40 characters of letters, digits, or hyphens.",
        };
      }
    }

    const note = input.note?.trim() ? input.note.trim().slice(0, 200) : undefined;

    try {
      const created = await createInvite({ note, maxUses, expiresAt, code });
      return { ok: true, code: created.code };
    } catch (err) {
      if (err instanceof InviteCodeExistsError) {
        return { ok: false, error: err.message };
      }
      console.error("createInviteAction failed", err);
      return { ok: false, error: "Couldn't create the invite. Please try again." };
    }
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```
  cd dashboard && npx vitest run app/actions/invites.test.ts
  ```

  Expected: PASS — 16 tests (4 gate, 10 validation incl. `test.each` expansion, 2 error surfacing). Also confirm the allowlist still holds:

  ```
  cd dashboard && npx vitest run lib/serviceRoleAllowlist.test.ts
  ```

  Expected: PASS (the new action imports `@/lib/invites`, not `serviceSql`).

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/app/actions/invites.ts dashboard/app/actions/invites.test.ts
  git commit -m "feat(admin): isAdmin-gated createInviteAction server action"
  ```

---

### Task 4: Shared `AdminNav` + wire into `/admin/tenants`

**Files:**
- Create: `dashboard/components/admin/AdminNav.tsx`
- Test: `dashboard/components/admin/AdminNav.test.tsx` (jsdom)
- Modify: `dashboard/app/admin/tenants/page.tsx` (import at top; render inside the wrap div, lines 74-77 region)

**Interfaces:**
- Produces: `export function AdminNav({ active }: { active: "tenants" | "invites" })` — consumed by both admin pages.
- Consumes: nothing (plain anchors; server-component-compatible — no `"use client"`).

- [ ] **Step 1: Write the failing test**

  Create `dashboard/components/admin/AdminNav.test.tsx`:

  ```tsx
  // @vitest-environment jsdom
  import { afterEach, describe, expect, test } from "vitest";
  import { cleanup, render, screen } from "@testing-library/react";
  import { AdminNav } from "./AdminNav";

  afterEach(cleanup);

  describe("AdminNav", () => {
    test("renders links to both admin consoles", () => {
      render(<AdminNav active="invites" />);
      expect(screen.getByRole("link", { name: "Tenants" }).getAttribute("href")).toBe(
        "/admin/tenants",
      );
      expect(screen.getByRole("link", { name: "Invites" }).getAttribute("href")).toBe(
        "/admin/invites",
      );
    });

    test("marks the active section with aria-current=page", () => {
      render(<AdminNav active="tenants" />);
      expect(
        screen.getByRole("link", { name: "Tenants" }).getAttribute("aria-current"),
      ).toBe("page");
      expect(
        screen.getByRole("link", { name: "Invites" }).getAttribute("aria-current"),
      ).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run components/admin/AdminNav.test.tsx
  ```

  Expected: fails to resolve `./AdminNav` (file does not exist yet).

- [ ] **Step 3: Write the implementation**

  Create `dashboard/components/admin/AdminNav.tsx`:

  ```tsx
  // Shared admin sub-nav (Tenants · Invites). Rendered ONLY inside already-
  // isAdmin-gated /admin/* pages, so it advertises nothing to non-admins — the
  // unadvertised-route convention holds: no public-header or AccountMenu link
  // points at /admin/*. Server-component-compatible (plain anchors, no state).

  export type AdminSection = "tenants" | "invites";

  const LINKS: { section: AdminSection; label: string; href: string }[] = [
    { section: "tenants", label: "Tenants", href: "/admin/tenants" },
    { section: "invites", label: "Invites", href: "/admin/invites" },
  ];

  export function AdminNav({ active }: { active: AdminSection }) {
    return (
      <nav aria-label="Admin sections" style={{ display: "flex", gap: "6px", margin: "0 0 14px" }}>
        {LINKS.map(({ section, label, href }) => {
          const isActive = section === active;
          return (
            <a
              key={section}
              href={href}
              aria-current={isActive ? "page" : undefined}
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                padding: "7px 12px",
                borderRadius: "9px",
                color: isActive ? "#161d29" : "#3b6fd4",
                background: isActive ? "#fff" : "transparent",
                border: isActive ? "1px solid #e7eaf0" : "1px solid transparent",
              }}
            >
              {label}
            </a>
          );
        })}
      </nav>
    );
  }
  ```

  Then wire it into `dashboard/app/admin/tenants/page.tsx`. Add the import after line 6 (`import { PLAN_LABEL } ...`):

  ```ts
  import { AdminNav } from "@/components/admin/AdminNav";
  ```

  And in the JSX, change:

  ```tsx
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <div style={cardStyle}>
  ```

  to:

  ```tsx
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="tenants" />
          <div style={cardStyle}>
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  ```
  cd dashboard && npx vitest run components/admin/AdminNav.test.tsx app/admin/tenants/page.test.ts
  ```

  Expected: PASS — 2 AdminNav tests, and the 4 existing tenants gate tests still green (the gate test never renders JSX, so the new nav is inert there).

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/components/admin/AdminNav.tsx dashboard/components/admin/AdminNav.test.tsx dashboard/app/admin/tenants/page.tsx
  git commit -m "feat(admin): shared Tenants/Invites sub-nav, wired into /admin/tenants"
  ```

---

### Task 5: `CopyButton` + `InviteGenerator` client components

**Files:**
- Create: `dashboard/components/admin/CopyButton.tsx`
- Create: `dashboard/components/admin/InviteGenerator.tsx`
- Test: `dashboard/components/admin/InviteGenerator.test.tsx` (jsdom; covers both components)

**Interfaces:**
- Consumes: `createInviteAction(input: CreateInviteInput): Promise<CreateInviteResult>` (Task 3), `useRouter` from `next/navigation`.
- Produces: `export function CopyButton({ text, style }: { text: string; style?: React.CSSProperties })` and `export function InviteGenerator()` — consumed by `app/admin/invites/page.tsx` (Task 6).

- [ ] **Step 1: Write the failing test**

  Create `dashboard/components/admin/InviteGenerator.test.tsx`:

  ```tsx
  // @vitest-environment jsdom
  import { afterEach, describe, expect, test, vi } from "vitest";
  import { cleanup, fireEvent, render, screen } from "@testing-library/react";

  // The generator is a thin client shell over the server action: assert on rendered
  // state and the values handed to the (mocked) action — never real network or DB
  // (dashboard-component-tests-jsdom convention).

  const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
  vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

  const action = vi.hoisted(() => ({
    createInviteAction: vi.fn<
      (input: unknown) => Promise<{ ok: true; code: string } | { ok: false; error: string }>
    >(async () => ({ ok: true, code: "RF-QQQQ-WWWW" })),
  }));
  vi.mock("@/app/actions/invites", () => action);

  import { InviteGenerator } from "./InviteGenerator";
  import { CopyButton } from "./CopyButton";

  afterEach(() => {
    cleanup();
    nav.refresh.mockClear();
    action.createInviteAction.mockClear();
  });

  describe("InviteGenerator", () => {
    test("renders note / max-uses / expires fields and a submit control; custom code starts collapsed", () => {
      render(<InviteGenerator />);
      expect(screen.getByLabelText("Note")).toBeTruthy();
      expect(screen.getByLabelText("Max uses")).toBeTruthy();
      expect(screen.getByLabelText("Expires")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate invite" })).toBeTruthy();
      expect(screen.queryByLabelText("Custom code")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Use a custom code" }));
      expect(screen.getByLabelText("Custom code")).toBeTruthy();
    });

    test("submits parsed values, shows the minted code, and refreshes the list", async () => {
      render(<InviteGenerator />);
      fireEvent.change(screen.getByLabelText("Note"), { target: { value: "beta friend" } });
      fireEvent.change(screen.getByLabelText("Max uses"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
      expect(await screen.findByText("RF-QQQQ-WWWW")).toBeTruthy();
      expect(action.createInviteAction).toHaveBeenCalledWith({
        note: "beta friend",
        maxUses: 5,
        expiresAt: null,
        code: undefined,
      });
      expect(nav.refresh).toHaveBeenCalledTimes(1);
    });

    test("an { ok: false } result shows the error and mints nothing", async () => {
      action.createInviteAction.mockResolvedValueOnce({
        ok: false,
        error: "That code already exists.",
      });
      render(<InviteGenerator />);
      fireEvent.click(screen.getByRole("button", { name: "Generate invite" }));
      expect(await screen.findByText("That code already exists.")).toBeTruthy();
      expect(screen.queryByText(/RF-QQQQ/)).toBeNull();
      expect(nav.refresh).not.toHaveBeenCalled();
    });
  });

  describe("CopyButton", () => {
    test("writes its text to the clipboard and flips to 'Copied'", async () => {
      const writeText = vi.fn(async () => {});
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      render(<CopyButton text="RF-QQQQ-WWWW" />);
      fireEvent.click(screen.getByRole("button", { name: "Copy RF-QQQQ-WWWW" }));
      expect(writeText).toHaveBeenCalledWith("RF-QQQQ-WWWW");
      expect(await screen.findByText("Copied")).toBeTruthy();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run components/admin/InviteGenerator.test.tsx
  ```

  Expected: fails to resolve `./InviteGenerator` (files do not exist yet).

- [ ] **Step 3: Write the implementation**

  Create `dashboard/components/admin/CopyButton.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";

  // Tiny client leaf so server-rendered admin tables can offer per-row copy.
  // Best-effort: clipboard can be unavailable (http, permissions) — failure is silent
  // and the label simply doesn't flip.
  export function CopyButton({ text, style }: { text: string; style?: React.CSSProperties }) {
    const [copied, setCopied] = useState(false);
    return (
      <button
        type="button"
        aria-label={`Copy ${text}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable — leave the label as "Copy" */
          }
        }}
        style={{
          border: "1px solid #dfe3ea",
          borderRadius: "8px",
          background: "#fff",
          color: "#5b6472",
          fontSize: "11.5px",
          fontWeight: 700,
          padding: "4px 9px",
          cursor: "pointer",
          fontFamily: "inherit",
          ...style,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }
  ```

  Create `dashboard/components/admin/InviteGenerator.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { createInviteAction } from "@/app/actions/invites";
  import { CopyButton } from "./CopyButton";

  // Admin invite-minting form (rendered inside the isAdmin-gated /admin/invites page;
  // the server action re-gates independently). On success it shows the minted code
  // with a copy affordance and router.refresh()es so the server-rendered list below
  // picks up the new row.

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b7480",
    textTransform: "uppercase",
    letterSpacing: ".4px",
    marginBottom: "4px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontSize: "13px",
    color: "#1f2430",
    background: "#f3f5f9",
    border: "1px solid #e7eaf0",
    borderRadius: "9px",
    padding: "8px 10px",
    fontFamily: "inherit",
  };

  export function InviteGenerator() {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [maxUses, setMaxUses] = useState("1");
    const [expires, setExpires] = useState("");
    const [customCode, setCustomCode] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [minted, setMinted] = useState<string | null>(null);

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      setMinted(null);
      try {
        const res = await createInviteAction({
          note: note.trim() || undefined,
          maxUses: Number(maxUses),
          expiresAt: expires || null,
          code: customCode.trim() || undefined,
        });
        if (!res.ok) {
          setError(res.error);
        } else {
          setMinted(res.code);
          setNote("");
          setCustomCode("");
          router.refresh(); // re-render the server list below with the new code
        }
      } catch {
        // The gate throws (redacted in prod) and network failures land here too.
        setError("Couldn't create the invite. Please try again.");
      } finally {
        setBusy(false);
      }
    };

    return (
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: "180px" }}>
            <label htmlFor="invite-note" style={labelStyle}>Note</label>
            <input
              id="invite-note"
              type="text"
              value={note}
              placeholder="Who is this for?"
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: "0 0 110px" }}>
            <label htmlFor="invite-max-uses" style={labelStyle}>Max uses</label>
            <input
              id="invite-max-uses"
              type="number"
              min={1}
              max={1000}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: "0 0 160px" }}>
            <label htmlFor="invite-expires" style={labelStyle}>Expires</label>
            <input
              id="invite-expires"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={{
              border: "none",
              borderRadius: "9px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#fff",
              background: "#3b6fd4",
              boxShadow: "0 4px 12px rgba(59,111,212,.28)",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {busy ? "Generating…" : "Generate invite"}
          </button>
        </div>

        {showCustom ? (
          <div style={{ marginTop: "10px", maxWidth: "280px" }}>
            <label htmlFor="invite-custom-code" style={labelStyle}>Custom code</label>
            <input
              id="invite-custom-code"
              type="text"
              value={customCode}
              placeholder="e.g. TEAM-2026"
              onChange={(e) => setCustomCode(e.target.value)}
              style={inputStyle}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            style={{
              marginTop: "10px",
              border: "none",
              background: "transparent",
              color: "#3b6fd4",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            Use a custom code
          </button>
        )}

        {error && (
          <div style={{ marginTop: "10px", fontSize: "12.5px", color: "#b23b3b" }}>{error}</div>
        )}

        {minted && (
          <div
            style={{
              marginTop: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "#eef3fc",
              border: "1px solid #d8e2f6",
              borderRadius: "10px",
              padding: "9px 12px",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: 700,
                fontSize: "14px",
                color: "#161d29",
              }}
            >
              {minted}
            </span>
            <CopyButton text={minted} />
          </div>
        )}
      </form>
    );
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```
  cd dashboard && npx vitest run components/admin/InviteGenerator.test.tsx
  ```

  Expected: PASS — 3 InviteGenerator tests + 1 CopyButton test.

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/components/admin/CopyButton.tsx dashboard/components/admin/InviteGenerator.tsx dashboard/components/admin/InviteGenerator.test.tsx
  git commit -m "feat(admin): invite generator form + shared copy button (client components)"
  ```

---

### Task 6: `/admin/invites` page (gated server component)

**Files:**
- Create: `dashboard/app/admin/invites/page.tsx`
- Test: `dashboard/app/admin/invites/page.test.ts` (node env; mirrors `app/admin/tenants/page.test.ts`)

**Interfaces:**
- Consumes: `listInvites(): Promise<InviteCode[]>` + `type InviteCode` (Task 2), `AdminNav` (Task 4), `InviteGenerator` + `CopyButton` (Task 5), `getUserClaims` (`@/lib/auth`), `isAdmin` (`@/lib/admin`), `notFound` (`next/navigation`).
- Produces: the `/admin/invites` route (default export `AdminInvitesPage`).

- [ ] **Step 1: Write the failing test**

  Create `dashboard/app/admin/invites/page.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

  // notFound() throws in Next; make the mock throw a sentinel we can assert on.
  class NotFoundError extends Error {
    constructor() {
      super("NEXT_NOT_FOUND");
    }
  }
  vi.mock("next/navigation", () => ({
    notFound: () => {
      throw new NotFoundError();
    },
    // The page imports InviteGenerator, which imports useRouter from this module.
    // It is never CALLED here (the gate test never renders JSX), but the mocked
    // module must still define the export or vitest errors on access.
    useRouter: () => ({ refresh: () => {} }),
  }));

  const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
  vi.mock("@/lib/auth", () => auth);

  const invites = vi.hoisted(() => ({ listInvites: vi.fn(async () => []) }));
  vi.mock("@/lib/invites", () => invites);

  const OLD = process.env.ADMIN_EMAILS;
  const { default: AdminInvitesPage } = await import("@/app/admin/invites/page");

  beforeEach(() => {
    auth.getUserClaims.mockReset();
    invites.listInvites.mockClear();
  });
  afterEach(() => {
    if (OLD === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = OLD;
    vi.restoreAllMocks();
  });

  describe("AdminInvitesPage gate", () => {
    test("an authed NON-admin gets notFound() BEFORE any data fetch", async () => {
      process.env.ADMIN_EMAILS = "op@example.com";
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
      await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
      expect(invites.listInvites).not.toHaveBeenCalled();
    });

    test("fails closed: with ADMIN_EMAILS unset even a plausible email is notFound", async () => {
      delete process.env.ADMIN_EMAILS;
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
      await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
      expect(invites.listInvites).not.toHaveBeenCalled();
    });

    test("anon (null claims) is notFound, never a data response", async () => {
      process.env.ADMIN_EMAILS = "op@example.com";
      auth.getUserClaims.mockResolvedValue(null);
      await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
      expect(invites.listInvites).not.toHaveBeenCalled();
    });

    test("an admin proceeds to fetch the invite list", async () => {
      process.env.ADMIN_EMAILS = "op@example.com";
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
      await AdminInvitesPage();
      expect(invites.listInvites).toHaveBeenCalledOnce();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run app/admin/invites/page.test.ts
  ```

  Expected: fails at `await import("@/app/admin/invites/page")` — module does not exist yet.

- [ ] **Step 3: Write the implementation**

  Create `dashboard/app/admin/invites/page.tsx`:

  ```tsx
  import type { Metadata } from "next";
  import { notFound } from "next/navigation";
  import { getUserClaims } from "@/lib/auth";
  import { isAdmin } from "@/lib/admin";
  import { listInvites, type InviteCode } from "@/lib/invites";
  import { AdminNav } from "@/components/admin/AdminNav";
  import { InviteGenerator } from "@/components/admin/InviteGenerator";
  import { CopyButton } from "@/components/admin/CopyButton";

  export const dynamic = "force-dynamic";
  export const metadata: Metadata = { title: "Invites · Admin" };

  // Style tokens mirror app/admin/tenants/page.tsx so the admin consoles read as one
  // surface (narrower wrap — this table has 5 columns, not 11).
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "40px 20px 64px",
  };
  const wrapStyle: React.CSSProperties = { maxWidth: "860px", margin: "0 auto" };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #e7eaf0", borderRadius: "16px",
    boxShadow: "0 12px 40px rgba(15,22,35,.06)", padding: "22px 24px",
  };
  const thStyle: React.CSSProperties = {
    textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#6b7480",
    textTransform: "uppercase", letterSpacing: ".4px", padding: "8px 10px",
    borderBottom: "1px solid #e7eaf0", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    fontSize: "12.5px", color: "#3a4150", padding: "9px 10px",
    borderBottom: "1px solid #f0f2f6", whiteSpace: "nowrap",
  };

  function fmtDate(d: Date | null): string {
    return d ? new Date(d).toLocaleDateString() : "—";
  }

  function Row({ inv }: { inv: InviteCode }) {
    const exhausted = inv.uses >= inv.maxUses;
    const expired = inv.expiresAt != null && new Date(inv.expiresAt).getTime() <= Date.now();
    return (
      <tr>
        <td
          style={{
            ...tdStyle,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 600,
            color: "#161d29",
          }}
        >
          <span style={{ marginRight: "8px" }}>{inv.code}</span>
          <CopyButton text={inv.code} />
        </td>
        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: "140px" }}>{inv.note ?? "—"}</td>
        <td style={{ ...tdStyle, textAlign: "right", color: exhausted ? "#b23b3b" : undefined }}>
          {inv.uses}/{inv.maxUses}
        </td>
        <td style={{ ...tdStyle, color: expired ? "#b23b3b" : undefined }}>{fmtDate(inv.expiresAt)}</td>
        <td style={tdStyle}>{fmtDate(inv.createdAt)}</td>
      </tr>
    );
  }

  export default async function AdminInvitesPage() {
    const claims = await getUserClaims();
    // Non-admins (and anon that slipped past middleware) get a 404 — the route's very
    // existence is not advertised. The createInviteAction re-gates independently.
    if (!isAdmin(claims)) notFound();

    const invites = await listInvites();

    return (
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <AdminNav active="invites" />

          <div style={{ ...cardStyle, marginBottom: "18px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 800, color: "#161d29" }}>
              Invites
            </h1>
            <div style={{ fontSize: "12.5px", color: "#6b7480", marginBottom: "18px" }}>
              Generate invite codes for the invite-only beta and track how many uses each has left.
            </div>
            <InviteGenerator />
          </div>

          <div style={cardStyle}>
            {invites.length === 0 ? (
              <div style={{ fontSize: "13px", color: "#6b7480", padding: "24px 4px" }}>
                No invite codes yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "640px" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>Note</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Uses</th>
                      <th style={thStyle}>Expires</th>
                      <th style={thStyle}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <Row key={inv.code} inv={inv} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  ```
  cd dashboard && npx vitest run app/admin/invites/page.test.ts && npx tsc --noEmit
  ```

  Expected: PASS — 4 gate tests; typecheck clean.

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/app/admin/invites/page.tsx dashboard/app/admin/invites/page.test.ts
  git commit -m "feat(admin): /admin/invites page — generate + list invite codes, isAdmin-gated"
  ```

---

### Task 7: Feature 1 — anon header Sign in / Sign up anchors + board cleanup

**Files:**
- Test: `dashboard/components/rolefit/Header.test.tsx` (replace the anon test at lines 48-52)
- Modify: `dashboard/components/rolefit/Header.tsx` (label consts at lines 29-33; CTA render at lines 215-228)
- Modify: `dashboard/components/rolefit/RolefitBoard.tsx` (lines 942-948)

**Interfaces:**
- Consumes: existing `HeaderProps` (unchanged — `onOpenProfile` stays required; it just becomes authed-only in practice). Primary tokens from `components/ui/Button.tsx:31-35` (`#3b6fd4` fill, white text, shadow `0 4px 12px rgba(59,111,212,.28)`); secondary anchor style copied from the header's `Analytics`/`Companies` nav anchors (`Header.tsx:198-203`).
- Produces: no new exports. Verified consumers of `Header`: only `RolefitBoard.tsx:15` and its own test. Verified `onOpenProfile` call sites in `RolefitBoard.tsx`: line 942 (header — changes) and line 1077 (JobDetail — already `() => setProfileOpen(true)`, untouched).

- [ ] **Step 1: Write the failing test**

  In `dashboard/components/rolefit/Header.test.tsx`, replace the anon test (lines 48-52):

  ```tsx
    test("anon → 'Sign in' button and NO account menu", () => {
      renderHeader({ isAuthed: false, hasProfile: false, viewerEmail: null });
      expect(screen.getByRole("button", { name: /Sign in/ })).not.toBeNull();
      expect(screen.queryByRole("button", { name: /account/i })).toBeNull();
    });
  ```

  with:

  ```tsx
    test("anon → 'Sign in' link to /login + 'Sign up' link to /signup, NO account menu", () => {
      renderHeader({ isAuthed: false, hasProfile: false, viewerEmail: null });
      expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
      expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/signup");
      // The anon CTA is real navigation now — no button-based CTA, no account menu.
      expect(screen.queryByRole("button", { name: /Sign in/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /account/i })).toBeNull();
    });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```
  cd dashboard && npx vitest run components/rolefit/Header.test.tsx
  ```

  Expected: FAIL — `getByRole("link", { name: "Sign in" })` finds nothing (anon still renders a button); the other 7 Header tests stay green.

- [ ] **Step 3: Write the implementation**

  **(a)** In `dashboard/components/rolefit/Header.tsx`, replace lines 29-33:

  ```tsx
    // "Sign in" when anonymous; "Résumé" when authed with a saved profile (this button opens
    // the résumé-only modal — the new "Profile" link handles full settings); "Set up profile"
    // when authed but no profile yet.
    const profileBtnLabel = !isAuthed ? "Sign in" : hasProfile ? "Résumé" : "Set up profile";
    const profileBtnIcon = !isAuthed ? "→" : hasProfile ? "✎" : "+";
  ```

  with:

  ```tsx
    // Authed CTA label: "Résumé" when a saved profile exists (opens the résumé-only
    // modal — the "Profile" link handles full settings); "Set up profile" otherwise.
    // Anonymous visitors get Sign in / Sign up anchors instead (see the CTA cluster).
    const profileBtnLabel = hasProfile ? "Résumé" : "Set up profile";
    const profileBtnIcon = hasProfile ? "✎" : "+";
  ```

  **(b)** Replace the CTA block (lines 215-228):

  ```tsx
          {/* Résumé button — the board's primary action */}
          <Button
            variant="primary"
            onClick={onOpenProfile}
            style={{
              fontSize: "13px",
              padding: "9px 14px",
              border: "1px solid #3b6fd4",
              boxShadow: "none",
            }}
          >
            <span style={{ fontSize: "13px" }}>{profileBtnIcon}</span>
            <span>{profileBtnLabel}</span>
          </Button>
  ```

  with:

  ```tsx
          {/* CTA cluster. Authed: the Résumé / Set-up-profile button (the board's
              primary action). Anon: real navigation anchors — secondary "Sign in" then
              the primary "Sign up" rightmost (most prominent). Anchors, not <Button>,
              so middle-click/new-tab semantics work (Button renders a hardcoded
              <button>); tokens mirror components/ui/Button.tsx primary (#3b6fd4 fill,
              white text, the primary box-shadow) and the nav-anchor ghost style. */}
          {isAuthed ? (
            <Button
              variant="primary"
              onClick={onOpenProfile}
              style={{
                fontSize: "13px",
                padding: "9px 14px",
                border: "1px solid #3b6fd4",
                boxShadow: "none",
              }}
            >
              <span style={{ fontSize: "13px" }}>{profileBtnIcon}</span>
              <span>{profileBtnLabel}</span>
            </Button>
          ) : (
            <>
              <a
                href="/login"
                style={{
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "#3b6fd4",
                  textDecoration: "none",
                  padding: "9px 6px",
                }}
              >
                Sign in
              </a>
              <a
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "#fff",
                  background: "#3b6fd4",
                  border: "1px solid #3b6fd4",
                  borderRadius: "11px",
                  padding: "9px 14px",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(59,111,212,.28)",
                }}
              >
                Sign up
              </a>
            </>
          )}
  ```

  **(c)** In `dashboard/components/rolefit/RolefitBoard.tsx`, replace lines 942-948:

  ```tsx
          onOpenProfile={() => {
            if (isAuthed) {
              setProfileOpen(true);
            } else {
              window.location.href = "/login";
            }
          }}
  ```

  with:

  ```tsx
          // The header CTA is authed-only now (anon gets Sign in / Sign up anchors),
          // so this only ever opens the modal. (JobDetail's onOpenProfile below was
          // already modal-only.)
          onOpenProfile={() => setProfileOpen(true)}
  ```

  Do NOT touch the JobDetail `onOpenProfile={() => setProfileOpen(true)}` at line 1077, `app/login/page.tsx`, or `app/signup/page.tsx` (cross-links already exist).

- [ ] **Step 4: Run the tests to verify they pass — then the FULL suite + hygiene**

  ```
  cd dashboard && npx vitest run components/rolefit/Header.test.tsx
  ```

  Expected: PASS — all 8 Header tests including the new anon two-anchor test.

  Full verification (Feature 1 + Feature 2 together, allowlist, everything):

  ```
  cd dashboard && npx vitest run && npx tsc --noEmit && npm run lint
  ```

  Expected: full suite PASS (note: a `parseProfile` binary-fixture test skip is expected in a worktree), typecheck clean, `eslint .` clean.

- [ ] **Step 5: Commit** (repo root)

  ```
  git add dashboard/components/rolefit/Header.tsx dashboard/components/rolefit/Header.test.tsx dashboard/components/rolefit/RolefitBoard.tsx
  git commit -m "feat(board): anon header Sign in/Sign up anchors; drop dead anon redirect"
  ```

---

## Self-Review (run after writing, before handoff)

**Spec-section → task coverage:**

| Spec section | Task |
|---|---|
| Feature 1: anon header two anchors (order, styling, anchors-not-Button) | 7 |
| Feature 1: RolefitBoard dead-code cleanup (with other-caller check) | 7 (call sites pre-verified: only line 942 changes; 1077 untouched) |
| Feature 1: auth-page cross-links | None needed — already exist; explicitly excluded in File Structure |
| Feature 1 tests: Header anon assertion | 7 |
| Feature 2: `generateInviteCode` (format, alphabet, CSPRNG) | 1 |
| Feature 2: `createInvite` (defaults, RETURNING, retry, custom-collision error, `InviteCode`) | 1 |
| Feature 2: `listInvites` (ordered select, mapping) | 2 |
| Feature 2: server action (gate-first, maxUses 1..1000, future expiry, code charset) | 3 |
| Feature 2: `/admin/invites` page (gate, dynamic, metadata, tokens, form, table, empty state) | 6 |
| Feature 2: admin sub-nav on BOTH pages | 4 (component + tenants wiring) + 6 (invites side) |
| Feature 2 tests: lib / action / page-gate / component | 1-2 / 3 / 6 / 5 |
| Security model (double gate, serviceSql containment, CSPRNG, validation-before-DB, no secret logging) | Global Constraints + Tasks 1, 3, 6 |
| Data model / deployment (no migration, no env change) | Global Constraints |

**Placeholder scan:** every code step contains complete, paste-able code; no "similar to", no TBD/TODO stubs.

**Signature consistency:** `createInvite(opts?: CreateInviteOpts): Promise<InviteCode>` identical in Task 1 impl, Task 1 tests, Task 3 action + its mocked shape. `CreateInviteResult` union identical in Task 3 impl/tests and Task 5 mock. `listInvites(): Promise<InviteCode[]>` identical in Task 2 and Task 6's mock. `AdminNav({ active: "tenants" | "invites" })` identical in Tasks 4 and 6.

**Known deliberate deviations from the spec letter (flag to reviewer):**
1. `createInviteAction` returns `{ ok: true; code } | { ok: false; error }` instead of the spec's `Promise<{ code: string }>`-plus-throws — because Next.js redacts thrown server-action messages in production, which would break the spec's own "legible message the form can display" requirement. Gate failures still throw.
2. Two client components (`InviteGenerator` + `CopyButton`) instead of the spec's "the form is the only client component" — the spec's own per-row copy button requires a client leaf inside the server table.
