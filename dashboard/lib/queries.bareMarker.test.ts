import { describe, it, expect, vi } from "vitest";

// queries.ts opens the DB layer (@/lib/db calls postgres() at module load) and pulls in
// next/cache; stub both so this pure SQL-shape check imports without a real connection.
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), withAnonSql: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { bareMarkerPredicate } from "@/lib/queries";

describe("bareMarkerPredicate", () => {
  // A content-less "Mark as applied" marker is one where EVERY content column is NULL.
  // The un-apply DELETE (app/actions/applications.ts) keys off this set, and the client
  // hasContent twin (RolefitBoard.handleUnapply) mirrors it — so a saved instructions
  // draft has to appear here, or un-apply would delete a Save-before-generating row.
  it("requires all content columns — including both instruction-draft columns — to be NULL", () => {
    // Fake postgres.js tagged-template executor: the predicate interpolates no values,
    // so joining the static chunks reconstructs the raw SQL text.
    const tx = ((strings: TemplateStringsArray) =>
      strings.join("")) as unknown as Parameters<typeof bareMarkerPredicate>[0];

    const sql = bareMarkerPredicate(tx) as unknown as string;

    for (const col of [
      "resume_json",
      "cover_letter_json",
      "prefilled_answers",
      "apply_url",
      "resume_instructions_draft",
      "cover_letter_instructions_draft",
    ]) {
      expect(sql).toContain(`${col} IS NULL`);
    }
  });
});
