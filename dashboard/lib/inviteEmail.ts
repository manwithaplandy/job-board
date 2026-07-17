import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { USER_INVITE_EXPIRY_DAYS } from "@/lib/invites";

// Invite email over AWS SES (spec 2026-07-13). ENV NAMES ARE DELIBERATE: Vercel
// functions run on AWS Lambda, where AWS_REGION / AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY are reserved and overwritten by the platform's own runtime
// credentials — SES_* sidesteps that. Missing config degrades to a legible
// "not_configured" BEFORE any allowance is spent (the action checks sesConfig()
// up front); generate-code keeps working without email entirely.

export interface SesConfig {
  region: string;
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The full SES config, or null if ANY piece is missing (never half-configured). */
export function sesConfig(): SesConfig | null {
  const region = process.env.SES_REGION;
  const from = process.env.SES_FROM_ADDRESS;
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!region || !from || !accessKeyId || !secretAccessKey) return null;
  return { region, from, accessKeyId, secretAccessKey };
}

// One client per warm serverless instance; keyed by region so a config change
// mid-lifetime can't silently keep the old region.
let _client: { region: string; client: SESv2Client } | null = null;
function client(cfg: SesConfig): SESv2Client {
  if (_client?.region !== cfg.region) {
    _client = {
      region: cfg.region,
      client: new SESv2Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      }),
    };
  }
  return _client.client;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface InviteEmailParams {
  code: string;
  link: string;
  inviterEmail: string | null;
}

/** Subject + text + minimal HTML. Exported for tests; treat as internal. */
export function buildInviteEmail({ code, link, inviterEmail }: InviteEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const who = inviterEmail ? `${inviterEmail} invited you` : "You've been invited";
  const subject = "You're invited to Rolefit";
  const text = [
    `${who} to join Rolefit — a job-search copilot that reviews openings against your résumé.`,
    "",
    `Your invite code: ${code}`,
    `Sign up here: ${link}`,
    "",
    `This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days.`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(who)} to join <strong>Rolefit</strong> — a job-search copilot that reviews openings against your résumé.</p>`,
    `<p>Your invite code: <strong style="font-family:monospace">${escapeHtml(code)}</strong></p>`,
    `<p><a href="${escapeHtml(link)}">Accept your invite</a> (or paste the code at signup: ${escapeHtml(link)})</p>`,
    `<p style="color:#666;font-size:12px">This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days.</p>`,
  ].join("\n");
  return { subject, text, html };
}

export type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; error: "not_configured" | "send_failed" };

/** One SendEmail per recipient. Errors are logged and mapped — never thrown. */
export async function sendInviteEmail(
  params: InviteEmailParams & { to: string },
): Promise<SendInviteEmailResult> {
  const cfg = sesConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const { subject, text, html } = buildInviteEmail(params);
  try {
    await client(cfg).send(
      new SendEmailCommand({
        FromEmailAddress: cfg.from,
        Destination: { ToAddresses: [params.to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: text, Charset: "UTF-8" },
              Html: { Data: html, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    return { ok: true };
  } catch (err) {
    console.error("sendInviteEmail failed", err);
    return { ok: false, error: "send_failed" };
  }
}
