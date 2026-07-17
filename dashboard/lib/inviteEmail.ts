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

// Email clients resolve no CSS variables and strip external stylesheets, so the
// brand values are frozen here as raw hex, copied by hand from app/globals.css:
// the inline styles mirror the :root (light) tokens, the @media dark block mirrors
// :root[data-theme="dark"]. Keep both in step if the palette there moves. Layout
// is nested tables + inline styles throughout — the only dialect Outlook/Gmail
// render reliably; classes exist solely as hooks for the dark-mode overrides.
const SANS = `'Hanken Grotesk',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace`;

/** Subject + text + branded HTML. Exported for tests; treat as internal. */
export function buildInviteEmail({ code, link, inviterEmail }: InviteEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const who = inviterEmail ? `${inviterEmail} invited you` : "You've been invited";
  const subject = "You're invited to Rolefit";
  const blurb =
    "a job-search copilot that reviews every opening against your résumé and surfaces the roles worth your time";
  const text = [
    `${who} to join Rolefit — ${blurb}.`,
    "",
    `Your invite code: ${code}`,
    `Accept your invite: ${link}`,
    "",
    `This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days. If you weren't expecting it, you can safely ignore this email.`,
  ].join("\n");

  const whoHtml = inviterEmail
    ? `<strong class="rf-ink" style="color:#1f2430;">${escapeHtml(inviterEmail)}</strong> invited you`
    : "You've been invited";
  const linkHtml = escapeHtml(link);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&display=swap');
  @media (prefers-color-scheme: dark) {
    body, .rf-page { background: #12161e !important; }
    .rf-card { background: #1a1f2a !important; border-color: #2c3444 !important; }
    .rf-ink { color: #e7eaf1 !important; }
    .rf-body { color: #98a1b1 !important; }
    .rf-mute { color: #6b7585 !important; }
    .rf-eyebrow, .rf-link { color: #5b8def !important; }
    .rf-codebox { background: rgba(91,141,239,.15) !important; border-color: rgba(91,141,239,.32) !important; }
    .rf-code { color: #8fb2f5 !important; }
    .rf-rule { border-top-color: #2c3444 !important; }
  }
</style>
</head>
<body class="rf-page" style="margin:0;padding:0;background:#f4f6fa;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your single-use invite code is inside &mdash; it expires in ${USER_INVITE_EXPIRY_DAYS} days.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rf-page" bgcolor="#f4f6fa" style="background:#f4f6fa;">
<tr><td align="center" style="padding:44px 16px 36px;">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">

    <tr><td align="center" style="padding-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="32" height="32" align="center" valign="middle" bgcolor="#3b6fd4" style="width:32px;height:32px;border-radius:11px;background:#3b6fd4;color:#ffffff;font-family:${SANS};font-size:13px;line-height:32px;">&#9670;</td>
        <td class="rf-ink" style="padding-left:10px;font-family:${SANS};font-size:19px;font-weight:800;letter-spacing:-.4px;color:#1f2430;">Rolefit</td>
      </tr></table>
    </td></tr>

    <tr><td class="rf-card" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e7eaf0;border-radius:16px;padding:34px 32px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="rf-eyebrow" style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3b6fd4;">You're invited</td></tr>
        <tr><td class="rf-ink" style="padding:10px 0 0;font-family:${SANS};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-.3px;color:#1f2430;">Find the role that fits.</td></tr>
        <tr><td class="rf-body" style="padding:14px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:#5b6472;">${whoHtml} to join <strong class="rf-ink" style="color:#1f2430;">Rolefit</strong> &mdash; ${blurb}.</td></tr>

        <tr><td style="padding:26px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" class="rf-codebox" bgcolor="#eef3fc" style="background:#eef3fc;border:1px solid #d8e2f6;border-radius:11px;padding:18px 16px 20px;">
              <div class="rf-mute" style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8b94a3;">Your invite code</div>
              <div class="rf-code" style="padding-top:7px;font-family:${MONO};font-size:22px;font-weight:700;letter-spacing:.1em;color:#2f57a8;">${escapeHtml(code)}</div>
            </td>
          </tr></table>
        </td></tr>

        <tr><td align="center" style="padding:24px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="#3b6fd4" style="border-radius:11px;background:#3b6fd4;box-shadow:0 4px 12px rgba(59,111,212,.28);">
              <a href="${linkHtml}" style="display:inline-block;padding:14px 40px;font-family:${SANS};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:11px;">Accept your invite</a>
            </td>
          </tr></table>
        </td></tr>

        <tr><td align="center" class="rf-mute" style="padding:16px 0 26px;font-family:${SANS};font-size:13px;line-height:1.55;color:#8b94a3;">
          Or paste your code at signup:<br>
          <a href="${linkHtml}" class="rf-link" style="color:#3b6fd4;font-weight:600;text-decoration:none;word-break:break-all;">${linkHtml}</a>
        </td></tr>

        <tr><td class="rf-rule rf-mute" style="border-top:1px solid #e7eaf0;padding:16px 0 0;font-family:${SANS};font-size:13px;line-height:1.55;color:#8b94a3;">
          This invite is single-use and expires in ${USER_INVITE_EXPIRY_DAYS} days. If you weren't expecting it, you can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" class="rf-mute" style="padding:18px 8px 0;font-family:${SANS};font-size:12px;letter-spacing:.02em;color:#8b94a3;"><span class="rf-eyebrow" style="color:#3b6fd4;">&#9670;</span>&nbsp; Rolefit &middot; invite-only beta</td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
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
