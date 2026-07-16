import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Capture SendEmailCommand inputs without any AWS traffic.
const sends: unknown[] = [];
let failNext = false;
vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    async send(cmd: { input: unknown }) {
      if (failNext) throw new Error("ses down");
      sends.push(cmd.input);
      return {};
    }
  },
  SendEmailCommand: class {
    input: unknown;
    constructor(input: unknown) { this.input = input; }
  },
}));

import { buildInviteEmail, sendInviteEmail, sesConfig } from "@/lib/inviteEmail";

const ENV = ["SES_REGION", "SES_FROM_ADDRESS", "SES_ACCESS_KEY_ID", "SES_SECRET_ACCESS_KEY"] as const;

beforeEach(() => {
  sends.length = 0;
  failNext = false;
  vi.stubEnv("SES_REGION", "us-west-1");
  vi.stubEnv("SES_FROM_ADDRESS", "invites@andrewmalvani.com");
  vi.stubEnv("SES_ACCESS_KEY_ID", "AKIATEST");
  vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("sesConfig", () => {
  test("all four env vars present → config", () => {
    expect(sesConfig()).toEqual({
      region: "us-west-1",
      from: "invites@andrewmalvani.com",
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
    });
  });
  for (const k of ENV) {
    test(`missing ${k} → null (send path must fail legibly, never half-configured)`, () => {
      vi.stubEnv(k, "");
      expect(sesConfig()).toBeNull();
    });
  }
});

describe("buildInviteEmail", () => {
  test("contains the code, the link, and the inviter", () => {
    const m = buildInviteEmail({
      code: "RF-AAAA-2222",
      link: "https://rolefit.app/signup?code=RF-AAAA-2222",
      inviterEmail: "andrew@example.com",
    });
    expect(m.subject).toContain("Rolefit");
    for (const body of [m.text, m.html]) {
      expect(body).toContain("RF-AAAA-2222");
      expect(body).toContain("https://rolefit.app/signup?code=RF-AAAA-2222");
      expect(body).toContain("andrew@example.com");
      expect(body).toContain("30 days");
    }
  });
  test("HTML-escapes a hostile inviter email", () => {
    const m = buildInviteEmail({
      code: "RF-AAAA-2222", link: "https://x/signup",
      inviterEmail: `<img src=x onerror=alert(1)>@x.com`,
    });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
  });
  test("null inviter falls back to neutral copy", () => {
    const m = buildInviteEmail({ code: "C", link: "L", inviterEmail: null });
    expect(m.text).toContain("You've been invited");
  });
});

describe("sendInviteEmail", () => {
  test("sends via SES with the configured from-address", async () => {
    const r = await sendInviteEmail({
      to: "friend@example.com", code: "RF-AAAA-2222",
      link: "https://rolefit.app/signup?code=RF-AAAA-2222", inviterEmail: "a@b.com",
    });
    expect(r).toEqual({ ok: true });
    expect(sends).toHaveLength(1);
    const input = sends[0] as {
      FromEmailAddress: string;
      Destination: { ToAddresses: string[] };
    };
    expect(input.FromEmailAddress).toBe("invites@andrewmalvani.com");
    expect(input.Destination.ToAddresses).toEqual(["friend@example.com"]);
  });
  test("unconfigured env → not_configured, zero SES traffic", async () => {
    vi.stubEnv("SES_REGION", "");
    const r = await sendInviteEmail({ to: "x@y.com", code: "C", link: "L", inviterEmail: null });
    expect(r).toEqual({ ok: false, error: "not_configured" });
    expect(sends).toHaveLength(0);
  });
  test("an SES throw → send_failed (caller refunds the invite)", async () => {
    failNext = true;
    const r = await sendInviteEmail({ to: "x@y.com", code: "C", link: "L", inviterEmail: null });
    expect(r).toEqual({ ok: false, error: "send_failed" });
  });
});
