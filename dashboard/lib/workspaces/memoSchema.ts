// The search memo's shape (plan Task 1.7): "What I'm looking for", in seven fixed
// sections. One schema for the stored doc, a proposal's doc and the agent's output.
import { z } from "zod";
import type { MemoDoc } from "@/lib/workspaces/types";

export const MEMO_SECTION_MAX = 2000;
export const MEMO_RATIONALE_MAX = 500;

const section = z.string().max(MEMO_SECTION_MAX);

export const MemoDocSchema = z
  .object({
    role: section,
    locations: section,
    compensation: section,
    mustHaves: section,
    dealBreakers: section,
    companies: section,
    other: section,
  })
  .strict() satisfies z.ZodType<MemoDoc>;

/** Display order and labels; compileMemo writes the sections in this order. */
export const MEMO_SECTIONS: ReadonlyArray<{ key: keyof MemoDoc; label: string }> = [
  { key: "role", label: "Role and seniority" },
  { key: "locations", label: "Locations and arrangement" },
  { key: "compensation", label: "Compensation" },
  { key: "mustHaves", label: "Must-haves" },
  { key: "dealBreakers", label: "Deal-breakers" },
  { key: "companies", label: "Companies and industries" },
  { key: "other", label: "Anything else" },
];

export function emptyMemoDoc(): MemoDoc {
  return { role: "", locations: "", compensation: "", mustHaves: "", dealBreakers: "", companies: "", other: "" };
}
