import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// CI enforcement for the tenant-isolation trust model (spec 2026-07-03 subsystem B):
// `serviceSql` (lib/db.ts) is the privileged, RLS-BYPASSING pool. Any file that
// touches it can read/write ACROSS tenants, so the set of files referencing it is a
// deliberately tiny, reviewed allowlist — NOT a convention. Every user-facing read/
// write must instead go through withUserSql / withAnonSql (RLS-enforced).
//
// Adding a file here means "this path legitimately needs the service role" and MUST
// come with a justification comment in that file's header (see the existing ones).
// If this test fails, either move the offending code onto withUserSql/withAnonSql,
// or — only if it genuinely operates across all tenants (a backend/admin/webhook
// path) — add it here WITH a reviewed justification.
const ALLOWLIST = [
  "lib/db.ts", // defines serviceSql
  "lib/invites.ts", // pre-auth signup redemption (no JWT/session yet)
  "app/actions/companies.ts", // global discovery_state refresh (shared operator control)
  "app/api/stripe/webhook/route.ts", // Stripe posts anonymously; sole writer of the subscriptions mirror
].sort();

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["app", "lib"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// A file "uses" serviceSql only if it IMPORTS it from @/lib/db (gaining RLS-bypass
// power) or DEFINES it (lib/db.ts). A mere mention in a comment or a type annotation
// does not count — that's why we match the import/definition, not the bare token.
const USES_SERVICE_SQL =
  /import\s*(?:type\s+)?\{[^}]*\bserviceSql\b[^}]*\}\s*from\s*["']@\/lib\/db["']|export\s+const\s+serviceSql\b/;

describe("serviceSql import allowlist (RLS bypass boundary)", () => {
  test("only allowlisted files import/define serviceSql", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        if (USES_SERVICE_SQL.test(readFileSync(file, "utf8"))) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    expect(offenders.sort()).toEqual(ALLOWLIST);
  });
});
