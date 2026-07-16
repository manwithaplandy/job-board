import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  ESTABLISHED_STATE_PATH,
  ONBOARDING_STATE_PATH,
  readVercelProtectionBypassHeaders,
  readVisualCredentials,
  validateVisualBaseUrl,
  VISUAL_AUTH_DIR,
} from "./auth";

describe("visual authentication configuration", () => {
  test("requires the Vercel automation bypass secret without exposing values", () => {
    expect(() => readVercelProtectionBypassHeaders({})).toThrowError(
      new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required"),
    );

    const secret = "bypass-secret-must-stay-redacted";
    expect(
      readVercelProtectionBypassHeaders({
        VERCEL_AUTOMATION_BYPASS_SECRET: secret,
      }),
    ).toEqual({
      "x-vercel-protection-bypass": secret,
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  test("requires credentials in a fixed order", () => {
    expect(() => readVisualCredentials({})).toThrowError(
      new Error("VISUAL_AUTH_EMAIL is required"),
    );
    expect(() =>
      readVisualCredentials({ VISUAL_AUTH_EMAIL: "established@example.test" }),
    ).toThrowError(new Error("VISUAL_AUTH_PASSWORD is required"));
    expect(() =>
      readVisualCredentials({
        VISUAL_AUTH_EMAIL: "established@example.test",
        VISUAL_AUTH_PASSWORD: "established-secret",
      }),
    ).toThrowError(new Error("VISUAL_ONBOARDING_EMAIL is required"));
    expect(() =>
      readVisualCredentials({
        VISUAL_AUTH_EMAIL: "established@example.test",
        VISUAL_AUTH_PASSWORD: "established-secret",
        VISUAL_ONBOARDING_EMAIL: "onboarding@example.test",
      }),
    ).toThrowError(new Error("VISUAL_ONBOARDING_PASSWORD is required"));
  });

  test("returns separate established and onboarding credentials", () => {
    expect(
      readVisualCredentials({
        VISUAL_AUTH_EMAIL: "established@example.test",
        VISUAL_AUTH_PASSWORD: "established-secret",
        VISUAL_ONBOARDING_EMAIL: "onboarding@example.test",
        VISUAL_ONBOARDING_PASSWORD: "onboarding-secret",
      }),
    ).toEqual({
      established: {
        email: "established@example.test",
        password: "established-secret",
      },
      onboarding: {
        email: "onboarding@example.test",
        password: "onboarding-secret",
      },
    });
  });

  test("reports only the missing credential name", () => {
    const secrets = [
      "established@example.test",
      "established-secret",
      "onboarding@example.test",
    ];
    let error: unknown;
    try {
      readVisualCredentials({
        VISUAL_AUTH_EMAIL: secrets[0],
        VISUAL_AUTH_PASSWORD: secrets[1],
        VISUAL_ONBOARDING_EMAIL: secrets[2],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toEqual(new Error("VISUAL_ONBOARDING_PASSWORD is required"));
    for (const secret of secrets) expect(String(error)).not.toContain(secret);
  });

  test("does not place the Vercel bypass secret in a URL", () => {
    const source = readFileSync("tests/visual/auth.ts", "utf8");

    expect(source).not.toContain("searchParams");
    expect(source).not.toContain("x-vercel-protection-bypass=");
  });

  test("rejects missing, non-HTTPS, and non-Vercel base URLs", () => {
    expect(() => validateVisualBaseUrl(undefined)).toThrow(
      "VISUAL_BASE_URL is required",
    );
    for (const raw of [
      "not-a-url",
      "http://preview.vercel.app",
      "https://example.com",
      "https://vercel.app",
      "https://preview.vercel.app.evil.example",
    ]) {
      expect(() => validateVisualBaseUrl(raw)).toThrow(
        "VISUAL_BASE_URL must be an HTTPS Vercel Preview URL",
      );
    }
  });

  test("rejects credential-bearing and non-default-port preview URLs", () => {
    for (const raw of [
      "https://visual-user@preview.vercel.app",
      "https://visual-user:visual-password@preview.vercel.app",
      "https://preview.vercel.app:8443",
    ]) {
      expect(() => validateVisualBaseUrl(raw)).toThrow(
        "VISUAL_BASE_URL must be an HTTPS Vercel Preview URL",
      );
    }
  });

  test("normalizes an HTTPS Vercel preview URL to its origin", () => {
    expect(
      validateVisualBaseUrl(
        "https://job-board-dashboard-git-example.vercel.app/path?query=secret#fragment",
      ),
    ).toBe("https://job-board-dashboard-git-example.vercel.app");
    expect(validateVisualBaseUrl("https://preview.vercel.app:443/")).toBe(
      "https://preview.vercel.app",
    );
  });

  test("uses distinct state files beneath the disposable auth directory", () => {
    expect(path.relative(process.cwd(), VISUAL_AUTH_DIR)).toBe(
      "test-results/visual-auth",
    );
    expect(ESTABLISHED_STATE_PATH).toBe(
      path.join(VISUAL_AUTH_DIR, "established.json"),
    );
    expect(ONBOARDING_STATE_PATH).toBe(
      path.join(VISUAL_AUTH_DIR, "onboarding.json"),
    );
    expect(ESTABLISHED_STATE_PATH).not.toBe(ONBOARDING_STATE_PATH);
  });
});
