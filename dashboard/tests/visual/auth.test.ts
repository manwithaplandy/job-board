import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  acquireLoginFormWithRetry,
  classifyVisualAuthRejection,
  ESTABLISHED_STATE_PATH,
  formatVisualAuthDiagnostic,
  ONBOARDING_STATE_PATH,
  readVercelProtectionBypassHeaders,
  readVisualCredentials,
  validateVisualBaseUrl,
  VISUAL_AUTH_DIR,
} from "./auth";

describe("visual authentication configuration", () => {
  test("classifies only fixed safe login rejection messages", () => {
    expect(classifyVisualAuthRejection("Incorrect email or password.")).toBe(
      "invalid_credentials",
    );
    expect(
      classifyVisualAuthRejection(
        "Please confirm your email address before signing in.",
      ),
    ).toBe("email_unconfirmed");
    expect(
      classifyVisualAuthRejection(
        "Too many attempts. Please wait a moment and try again.",
      ),
    ).toBe("rate_limited");
    expect(
      classifyVisualAuthRejection("Please enter a valid email address."),
    ).toBe("invalid_email");
    expect(
      classifyVisualAuthRejection("Something went wrong. Please try again."),
    ).toBe("generic_or_unknown");
    expect(
      classifyVisualAuthRejection(
        "unexpected account=user@example.test password=do-not-emit",
      ),
    ).toBe("generic_or_unknown");
  });

  test("captures final login-form failure evidence without masking the primary error", async () => {
    let acquisitions = 0;
    let reloads = 0;
    let captures = 0;

    await expect(
      acquireLoginFormWithRetry(
        async () => {
          acquisitions += 1;
          throw new Error(
            acquisitions === 1 ? "transient bootstrap" : "still unavailable",
          );
        },
        async () => {
          reloads += 1;
        },
        async () => {
          captures += 1;
          throw new Error("screenshot unavailable");
        },
        50,
      ),
    ).rejects.toThrow("still unavailable");

    expect(acquisitions).toBe(2);
    expect(reloads).toBe(1);
    expect(captures).toBe(1);
  });

  test("promptly rethrows the acquisition error when evidence never settles", async () => {
    const result = await Promise.race([
      acquireLoginFormWithRetry(
        async () => {
          throw new Error("still unavailable");
        },
        async () => undefined,
        () => new Promise<void>(() => undefined),
        5,
      ).then(
        () => "unexpected success",
        (error: unknown) =>
          error instanceof Error ? error.message : "unexpected error",
      ),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("external timeout"), 100);
      }),
    ]);

    expect(result).toBe("still unavailable");
  });

  test("formats bounded phase diagnostics without hosts, queries, or fragments", () => {
    const message = formatVisualAuthDiagnostic({
      identity: "established",
      phase: "authentication-outcome",
      currentUrl:
        "https://user:password@preview.vercel.app/login?token=secret#private",
      network: [
        { method: "GET", pathname: "/login?token=secret", status: 200 },
        { method: "POST", pathname: "/login#private", status: 503 },
      ],
      structure: { forms: 1, inputs: 2, buttons: 1, headings: 2 },
      rejection: "invalid_credentials",
    });

    expect(message).toContain("identity=established");
    expect(message).toContain("phase=authentication-outcome");
    expect(message).toContain("path=/login");
    expect(message).toContain("GET /login 200");
    expect(message).toContain("POST /login 503");
    expect(message).toContain(
      "structure=[forms=1 inputs=2 buttons=1 headings=2]",
    );
    expect(message).toContain("rejection=invalid_credentials");
    for (const secret of [
      "preview.vercel.app",
      "user",
      "password",
      "token",
      "private",
      "secret",
    ]) {
      expect(message).not.toContain(secret);
    }
  });

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
      "x-vercel-skip-toolbar": "1",
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
