import { describe, expect, test } from "vitest";
import { parseScreeningAnswers } from "@/lib/screeningAnswers";

describe("parseScreeningAnswers", () => {
  const obj = { notice_period: "2 weeks", salary_expectation: "$180k", relocation: "Open to it" };

  test("passes a clean object through, keeping all non-empty string keys (open map)", () => {
    expect(parseScreeningAnswers({ ...obj, custom_q: "yes" })).toEqual({ ...obj, custom_q: "yes" });
  });

  test("unwraps a single-encoded JSON string", () => {
    expect(parseScreeningAnswers(JSON.stringify(obj))).toEqual(obj);
  });

  test("unwraps a triple-encoded JSON string (the prod-corruption shape)", () => {
    let v: string = JSON.stringify(obj);
    v = JSON.stringify(v);
    v = JSON.stringify(v);
    expect(parseScreeningAnswers(v)).toEqual(obj);
  });

  test("drops null/blank/non-string values and coerces null/garbage input to {}", () => {
    expect(parseScreeningAnswers(null)).toEqual({});
    expect(parseScreeningAnswers(undefined)).toEqual({});
    expect(parseScreeningAnswers("not json")).toEqual({});
    expect(parseScreeningAnswers([1, 2])).toEqual({});
    expect(parseScreeningAnswers({ notice_period: "  ", salary_expectation: null, relocation: 42 })).toEqual({});
  });
});
