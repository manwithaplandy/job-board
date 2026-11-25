// dashboard/lib/zodParse.ts
//
// The one way zod is used at a data boundary: as a TOTAL parser. A jsonb read or an
// LLM output goes through `parseOrNull`, which unwraps one level of double-encoded
// jsonb (postgres.js returns a jsonb string scalar as a JS string) and then
// `safeParse`s it. It returns a valid typed value or null and never throws.
import type { z } from "zod";
import { unwrapJsonb } from "@/lib/rolefit/packageCodec";

export function parseOrNull<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const result = schema.safeParse(unwrapJsonb(raw));
  return result.success ? result.data : null;
}
