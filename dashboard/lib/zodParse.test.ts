import { expect, test } from "vitest";
import { z } from "zod";
import { parseOrNull } from "./zodParse";

const S = z.object({ a: z.number() });
test("returns the value for a valid object", () => expect(parseOrNull(S, { a: 1 })).toEqual({ a: 1 }));
test("unwraps a double-encoded jsonb string", () => expect(parseOrNull(S, '{"a":1}')).toEqual({ a: 1 }));
test("returns null, never throws, for garbage", () => {
  for (const raw of [null, undefined, "x", '"x"', 7, [], { a: "1" }]) expect(parseOrNull(S, raw)).toBeNull();
});
test("returns null, never throws, when the schema itself throws in safeParse", () => {
  const asyncRefine = z.object({ a: z.number() }).refine(async () => true);
  const throwingTransform = z.object({ a: z.number() }).transform(() => {
    throw new Error("boom");
  });
  expect(parseOrNull(asyncRefine, { a: 1 })).toBeNull();
  expect(parseOrNull(throwingTransform, { a: 1 })).toBeNull();
});
