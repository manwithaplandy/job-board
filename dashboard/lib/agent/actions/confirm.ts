// Fixed confirmations (plan Task 1.14, spec section 10 "Non-generative confirmation").
//
// describeConfirmation builds a confirm card for a high-risk or spending action from
// database values only: the job's title and company, the remaining monthly allowance
// (monthlyAllowance minus monthlyGenerationSpend), whether the posting's stored questions
// ask for a cover letter (the rule startApplicationPrep charges by), a document's
// filename, fixed field labels. The input is parsed for ids, enum values and the values
// being approved; any other text in it (a title, a line) is never read, so the model
// cannot write the card's title, lines, costs or button.
//
// The values being approved (propose_profile_details' fields and screening answers,
// refine_documents' target and instructions) are the subject of the approval, so the
// card shows them: in `proposed`, under fixed labels, flattened to one line, trimmed and
// capped, for the client to render as plain text labelled as proposed.
//
// A confirm token carries the intent that was confirmed, the thread and surface it came
// from, its issue time and a 10 minute expiry, signed with HMAC-SHA256 under
// AGENT_TOOL_APPROVAL_SECRET over the session user and that payload. Verifying needs the same user, so a token
// cannot be used by another user, and the job id is inside the signed payload, so it
// cannot be replayed for another job. The secret and the signed message are never
// logged, returned or stored.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { parseOrNull } from "@/lib/zodParse";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { monthlyAllowance, type Plan } from "@/lib/entitlements";
import { monthlyGenerationSpend, type GenerationKind } from "@/lib/usage";
import { getViewerPlan } from "@/lib/subscriptions";
import { parseGreenhouseQuestionsJsonb } from "@/lib/rolefit/packageCodec";
import { hasCoverLetterQuestion } from "@/lib/rolefit/coverLetterQuestion";
import { loadTierConfig } from "@/lib/tierConfig";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { ActionIntentSchema, type ActionIntent, type ConfirmDescriptor } from "@/lib/agent/actions/intents";
import { PROFILE_DETAIL_LABELS, ProfileDetailsInputSchema } from "@/lib/agent/actions/profileDetails";

export type ConfirmKind = "application.prepare" | "set_resume" | "propose_profile_details" | "refine_documents";
export const CONFIRM_TTL_MS = 10 * 60 * 1000;
/** The intents that only ever run through a confirm card. */
export const CONFIRM_INTENTS: ReadonlySet<ActionIntent["name"]> = new Set(["application.prepare"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DB_TEXT_MAX = 120;

const jobInput = z.object({ jobId: z.string().regex(JOB_ID_RE) });
const refineInput = z.object({
  jobId: z.string().regex(JOB_ID_RE),
  target: z.enum(["resume", "cover", "both"]),
  instructions: z.string(),
});
const documentInput = z.object({ documentId: z.string().regex(UUID_RE) });

/** Caps on the proposed values a card shows (each value, after flattening and trimming). */
export const PROPOSED_VALUE_MAX = 200;
export const PROPOSED_INSTRUCTIONS_MAX = 300;
export const PROPOSED_ANSWERS_SHOWN = 10;

const LINK_LABELS = { linkedin: "LinkedIn link", github: "GitHub link", portfolio: "Portfolio link" } as const;
const REFINE_TARGET_LABELS = { resume: "Résumé", cover: "Cover letter", both: "Résumé and cover letter" } as const;

// Control and bidi-override characters would let a value break its line or reorder what
// the user reads; they become spaces.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

function clamp(text: string, max: number = DB_TEXT_MAX): string {
  const flat = text.replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

const yesNo = (b: boolean) => (b ? "Yes" : "No");

/** One "<label>: <value>" line per proposed profile detail, then the screening answers. */
function proposedProfileDetails(input: z.infer<typeof ProfileDetailsInputSchema>): string[] {
  const out: string[] = [];
  const f = input.fields;
  for (const key of Object.keys(PROFILE_DETAIL_LABELS) as (keyof typeof PROFILE_DETAIL_LABELS)[]) {
    if (key === "links") {
      for (const link of Object.keys(LINK_LABELS) as (keyof typeof LINK_LABELS)[]) {
        const url = f.links?.[link];
        if (url !== undefined) out.push(`${LINK_LABELS[link]}: ${clamp(url, PROPOSED_VALUE_MAX)}`);
      }
      continue;
    }
    const value = f[key];
    if (value === undefined) continue;
    out.push(`${PROFILE_DETAIL_LABELS[key]}: ${typeof value === "boolean" ? yesNo(value) : clamp(value, PROPOSED_VALUE_MAX)}`);
  }
  const answers = Object.entries(input.screeningAnswers ?? {});
  for (const [id, answer] of answers.slice(0, PROPOSED_ANSWERS_SHOWN)) out.push(`${id}: ${clamp(answer, PROPOSED_VALUE_MAX)}`);
  if (answers.length > PROPOSED_ANSWERS_SHOWN) out.push(`and ${answers.length - PROPOSED_ANSWERS_SHOWN} more`);
  return out;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const KIND_NOUN: Record<GenerationKind, [string, string]> = {
  resume: ["résumé", "résumés"],
  cover: ["cover letter", "cover letters"],
};

async function jobLine(userId: string, jobId: string): Promise<string | null> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT j.title, COALESCE(c.display_name, c.name) AS company
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.id = ${jobId}`);
  const r = parseOrNull(z.object({ title: z.string().min(1), company: z.string().min(1) }), rows[0]);
  return r ? `${clamp(r.title)} at ${clamp(r.company)}` : null;
}

/**
 * Whether a full prep of this job writes a cover letter: the rule startApplicationPrep
 * charges by (hasCoverLetterQuestion over the posting's questions), read from the stored
 * questions; null when they are not stored yet.
 */
async function prepWantsCover(userId: string, jobId: string): Promise<boolean | null> {
  const rows = await withUserSql(userId, (tx) => tx`SELECT questions FROM job_questions WHERE job_id = ${jobId}`);
  const row = parseOrNull(z.object({ questions: z.unknown() }), rows[0]);
  const questions = row ? parseGreenhouseQuestionsJsonb(row.questions) : null;
  return questions === null ? null : hasCoverLetterQuestion(questions);
}

/**
 * The allowance lines for the kinds an action would spend. `coverIfAsked` (a prep whose
 * posting's questions are not stored yet; `kinds` then holds both) says the cover letter
 * is spent only if the posting asks for one.
 */
async function allowanceLines(
  userId: string,
  email: string | null,
  kinds: GenerationKind[],
  coverIfAsked = false,
): Promise<string[]> {
  const plan: Plan | null = await getViewerPlan(userId, email);
  const uses = coverIfAsked
    ? `Uses ${count(1, ...KIND_NOUN.resume)}, and ${count(1, ...KIND_NOUN.cover)} if the posting asks for one, from your monthly allowance.`
    : `Uses ${kinds.map((k) => count(1, ...KIND_NOUN[k])).join(" and ")} from your monthly allowance.`;
  if (!plan) return [uses, "Generating needs a subscription."];
  const { entitlements } = await loadTierConfig();
  const spent = await withUserSql(userId, async (tx) => {
    const out: Partial<Record<GenerationKind, number>> = {};
    for (const kind of kinds) out[kind] = await monthlyGenerationSpend(tx, userId, kind);
    return out;
  });
  const left = kinds.map((k) => {
    const remaining = Math.max(0, monthlyAllowance(plan, k, entitlements) - (spent[k] ?? 0));
    return count(remaining, ...KIND_NOUN[k]);
  });
  return [uses, `Left this month: ${left.join(", ")}.`];
}

/**
 * The fixed confirm card for `kind`, or null when its target is not found for this user
 * or the input does not parse. Only ids, enum values and the values being approved (into
 * `proposed`, never into the title, lines or button) are read from `input`.
 */
export async function describeConfirmation(
  userId: string,
  kind: ConfirmKind,
  input: unknown,
  email: string | null = null,
): Promise<ConfirmDescriptor | null> {
  switch (kind) {
    case "application.prepare": {
      const p = jobInput.safeParse(input);
      if (!p.success) return null;
      const job = await jobLine(userId, p.data.jobId);
      if (!job) return null;
      const wantsCover = await prepWantsCover(userId, p.data.jobId);
      const lines =
        wantsCover === null
          ? await allowanceLines(userId, email, ["resume", "cover"], true)
          : await allowanceLines(userId, email, wantsCover ? ["resume", "cover"] : ["resume"]);
      return {
        title: "Prepare this application?",
        lines: [job, ...lines],
        confirmLabel: "Prepare",
        danger: false,
      };
    }
    case "refine_documents": {
      const p = refineInput.safeParse(input);
      if (!p.success) return null;
      const job = await jobLine(userId, p.data.jobId);
      if (!job) return null;
      const kinds: GenerationKind[] = p.data.target === "both" ? ["resume", "cover"] : [p.data.target];
      return {
        title: "Regenerate with your instructions?",
        lines: [job, ...(await allowanceLines(userId, email, kinds))],
        proposed: [
          `Regenerate: ${REFINE_TARGET_LABELS[p.data.target]}`,
          `Instructions: ${clamp(p.data.instructions, PROPOSED_INSTRUCTIONS_MAX)}`,
        ],
        confirmLabel: "Regenerate",
        danger: false,
      };
    }
    case "set_resume": {
      const p = documentInput.safeParse(input);
      if (!p.success) return null;
      const rows = await withUserSql(userId, (tx) => tx`
        SELECT filename FROM documents WHERE id = ${p.data.documentId}::uuid AND user_id = ${userId}::uuid`);
      const r = parseOrNull(z.object({ filename: z.string().min(1) }), rows[0]);
      if (!r) return null;
      return {
        title: "Use this file as your résumé?",
        lines: [`File: ${clamp(r.filename)}`, "Your current résumé is kept as an earlier version you can restore."],
        confirmLabel: "Use as résumé",
        danger: false,
      };
    }
    case "propose_profile_details": {
      const p = ProfileDetailsInputSchema.safeParse(input);
      if (!p.success) return null;
      return {
        title: "Save these application details?",
        lines: ["Each one replaces what your application details hold for it now."],
        proposed: proposedProfileDetails(p.data),
        confirmLabel: "Save details",
        danger: false,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Confirm tokens
// ---------------------------------------------------------------------------

const tokenPayloadSchema = z
  .object({
    v: z.literal(1),
    intent: z.unknown(),
    threadId: z.string().regex(UUID_RE),
    surfaceId: z.string().regex(UUID_RE),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .strict();

export interface ConfirmedIntent {
  intent: ActionIntent;
  threadId: string;
  surfaceId: string;
}

/**
 * A verified token: the intent plus its issue time (epoch ms). confirmIntent refuses a
 * token whose job already has a prep created after `issuedAt`, so a token starts at most
 * one prep (a double press or a retried request cannot spend twice).
 */
export interface VerifiedConfirm extends ConfirmedIntent {
  issuedAt: number;
}

function mac(secret: string, userId: string, body: string): Buffer {
  return createHmac("sha256", secret).update(`agent-confirm:v1:${userId}:${body}`, "utf8").digest();
}

/** Signs a confirm token, or null when the approval secret is missing. */
export function signConfirmToken(
  userId: string,
  c: ConfirmedIntent,
  now: number = Date.now(),
): string | null {
  const secret = approvalSecret();
  if (!secret) return null;
  const body = Buffer.from(
    JSON.stringify({ v: 1, intent: c.intent, threadId: c.threadId, surfaceId: c.surfaceId, iat: now, exp: now + CONFIRM_TTL_MS }),
    "utf8",
  ).toString("base64url");
  return `${body}.${mac(secret, userId, body).toString("base64url")}`;
}

/** The confirmed intent, or null when the token is malformed, forged, another user's or expired, or the secret is missing. */
export function verifyConfirmToken(userId: string, token: unknown, now: number = Date.now()): VerifiedConfirm | null {
  const secret = approvalSecret();
  if (!secret || typeof token !== "string" || token.length > 8000) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = mac(secret, userId, body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const payload = parseOrNull(tokenPayloadSchema, json);
  if (!payload || payload.exp <= now || payload.iat > payload.exp) return null;
  const intent = ActionIntentSchema.safeParse(payload.intent);
  if (!intent.success || !CONFIRM_INTENTS.has(intent.data.name)) return null;
  return { intent: intent.data, threadId: payload.threadId, surfaceId: payload.surfaceId, issuedAt: payload.iat };
}
