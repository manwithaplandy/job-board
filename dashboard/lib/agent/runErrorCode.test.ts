// agent_runs.error codes (runs.ts runErrorCode): a short code or a status code passes;
// anything else is stored as unknown_error (PR K3: model_error:401 was lost this way).
import { expect, test } from "vitest";
import { runErrorCode } from "@/lib/agent/runs";

test.each(["model_error", "model_error:401", "model_error:503", "bad_input", "wall_clock"])("%s is kept", (code) => {
  expect(runErrorCode(code)).toBe(code);
});

test.each([
  "Provider said: 401 Unauthorized",
  "model_error:4011",
  "model_error:abc",
  "Model_error",
  ":401",
  `a${"b".repeat(64)}`,
])("%s becomes unknown_error", (code) => {
  expect(runErrorCode(code)).toBe("unknown_error");
});
