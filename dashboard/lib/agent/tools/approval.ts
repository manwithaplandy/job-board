// Tools that need the user's approval (plan Task 1.16, spec 8.1). Each is listed in
// TOOL_APPROVAL as "user-approval", so the AI SDK stops the turn with the tool part at
// `approval-requested` (signed with AGENT_TOOL_APPROVAL_SECRET) and execute runs only
// once the user approves, in the next turn (lib/agent/loop.ts patches the stored part).
// The confirm card the client shows for a pending part is built from the database by
// describeConfirmation (lib/agent/actions/confirm.ts), never from model text.
//
// The secret fails closed (PR I2 ruling): without it, or in an unattended run, no
// approval tool is offered and approvalStreamOptions passes neither toolApproval nor
// the secret. No input schema takes a user id; the user is ctx.userId.
//
//   start_application_prep  prepares a Greenhouse application (spends allowance)
//   set_resume              makes an uploaded document the résumé (undoable)
//   refine_documents        saves new instructions and regenerates (spends allowance)
//   propose_profile_details fills reusable application answers; never EEO answers
import { tool } from "ai";
import { z } from "zod";
import type { ToolCtx } from "@/lib/agent/tools";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { ProfileDetailsInputSchema, type ProfileDetailsInput } from "@/lib/agent/actions/profileDetails";
import { startApplicationPrep, type PrepOutcome } from "@/lib/applicationPrep";
import { ResumeInputError, setResumeFromDocument } from "@/lib/workspaces/resumeVersions";
import { withUserSql } from "@/lib/db";
import { isAccountDeleted } from "@/lib/tombstone";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { parseOrNull } from "@/lib/zodParse";

export const TOOL_APPROVAL = {
  start_application_prep: "user-approval",
  set_resume: "user-approval",
  refine_documents: "user-approval",
  propose_profile_details: "user-approval",
} as const;
export type ApprovalToolName = keyof typeof TOOL_APPROVAL;

export const REFINE_INSTRUCTIONS_MAX = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jobId = z.string().regex(JOB_ID_RE).max(300);

export const startPrepInput = z.object({ jobId }).strict();
export const setResumeInput = z.object({ documentId: z.string().regex(UUID_RE) }).strict();
export const refineInput = z
  .object({
    jobId,
    target: z.enum(["resume", "cover", "both"]),
    instructions: z.string().trim().min(1).max(REFINE_INSTRUCTIONS_MAX),
  })
  .strict();

export type ApprovalRefusal = {
  status: "refused";
  reason: "unusable_document" | "no_profile" | "account_deleted";
};

/** What the model reads back from a prep: the outcome's status and nothing of the gate's text. */
export type PrepToolResult =
  | { status: "started"; generationId: string }
  | { status: "already_running"; generationId: string }
  | { status: "allowance_exhausted"; kind: "resume" | "cover" }
  | { status: Exclude<PrepOutcome["status"], "started" | "already_running" | "allowance_exhausted"> };

function prepResult(out: PrepOutcome): PrepToolResult {
  if (out.status === "started" || out.status === "already_running") return { status: out.status, generationId: out.generationId };
  if (out.status === "allowance_exhausted") return { status: out.status, kind: out.kind };
  return { status: out.status };
}

// ---------------------------------------------------------------------------
// Executes (exported for tests; each runs only after the user approved)
// ---------------------------------------------------------------------------

export async function startApplicationPrepTool(ctx: ToolCtx, input: z.infer<typeof startPrepInput>): Promise<PrepToolResult> {
  return prepResult(await startApplicationPrep(ctx.userId, ctx.email, input.jobId));
}

export async function setResumeTool(ctx: ToolCtx, input: z.infer<typeof setResumeInput>) {
  try {
    const out = await setResumeFromDocument(ctx.userId, { documentId: input.documentId, actor: "agent", audit: ctx });
    return { status: "done" as const, actionId: out.actionId, displacedVersion: out.displacedVersion };
  } catch (e) {
    if (e instanceof ResumeInputError) return { status: "refused", reason: "unusable_document" } satisfies ApprovalRefusal;
    throw e;
  }
}

export async function refineDocumentsTool(ctx: ToolCtx, input: z.infer<typeof refineInput>): Promise<PrepToolResult> {
  return prepResult(
    await startApplicationPrep(ctx.userId, ctx.email, input.jobId, {
      refine: { target: input.target },
      resumeInstructions: input.target === "cover" ? null : input.instructions,
      coverLetterInstructions: input.target === "resume" ? null : input.instructions,
    }),
  );
}

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

/**
 * Writes only the listed application answers. Links and screening answers merge into
 * the stored objects; the EEO columns are neither read nor written, so they never reach
 * the agent and are never changed by it.
 */
export async function proposeProfileDetailsTool(ctx: ToolCtx, input: ProfileDetailsInput) {
  if (await isAccountDeleted(ctx.userId)) return { status: "refused", reason: "account_deleted" } satisfies ApprovalRefusal;
  const f = input.fields;
  const answers = input.screeningAnswers ?? {};
  const rows = await withUserSql(ctx.userId, (tx) => tx`
    UPDATE profiles SET
      full_name = CASE WHEN ${has(f, "full_name")} THEN ${f.full_name ?? null} ELSE full_name END,
      email = CASE WHEN ${has(f, "email")} THEN ${f.email ?? null} ELSE email END,
      phone = CASE WHEN ${has(f, "phone")} THEN ${f.phone ?? null} ELSE phone END,
      location = CASE WHEN ${has(f, "location")} THEN ${f.location ?? null} ELSE location END,
      work_authorized = CASE WHEN ${has(f, "work_authorized")} THEN ${f.work_authorized ?? null}::boolean ELSE work_authorized END,
      needs_sponsorship = CASE WHEN ${has(f, "needs_sponsorship")} THEN ${f.needs_sponsorship ?? null}::boolean ELSE needs_sponsorship END,
      links = links || ${JSON.stringify(f.links ?? {})}::text::jsonb,
      screening_answers = screening_answers || ${JSON.stringify(answers)}::text::jsonb,
      updated_at = now()
    WHERE user_id = ${ctx.userId}::uuid
    RETURNING 1 AS ok`);
  if (!parseOrNull(z.object({ ok: z.literal(1) }), rows[0])) return { status: "refused", reason: "no_profile" } satisfies ApprovalRefusal;
  return { status: "done" as const, fields: Object.keys(f), screeningAnswers: Object.keys(answers).length };
}

// ---------------------------------------------------------------------------
// The tool set
// ---------------------------------------------------------------------------

/** The approval tools; none without the secret or in an unattended run. */
export function approvalTools(ctx: ToolCtx) {
  return ctx.unattended || approvalSecret() === null ? noApprovalTools() : attendedApprovalTools(ctx);
}

function noApprovalTools(): Partial<ReturnType<typeof attendedApprovalTools>> {
  return {};
}

function attendedApprovalTools(ctx: ToolCtx) {
  return {
    start_application_prep: tool({
      description:
        "Prepare the application package for a Greenhouse job: a tailored résumé, prefilled answers and, when the " +
        "posting asks, a cover letter. Uses the user's monthly allowance. The user approves it on a card first.",
      inputSchema: startPrepInput,
      execute: (input) => startApplicationPrepTool(ctx, input),
    }),
    set_resume: tool({
      description:
        "Make one of the user's uploaded documents (with readable text) their résumé. The current résumé is kept " +
        "as an earlier version. The user approves it on a card first. Undoable.",
      inputSchema: setResumeInput,
      execute: (input) => setResumeTool(ctx, input),
    }),
    refine_documents: tool({
      description:
        `Regenerate a job's résumé, cover letter or both with new instructions (1 to ${REFINE_INSTRUCTIONS_MAX} ` +
        "characters). Saves the instructions and uses one allowance per document. The user approves it on a card first.",
      inputSchema: refineInput,
      execute: (input) => refineDocumentsTool(ctx, input),
    }),
    propose_profile_details: tool({
      description:
        "Fill the user's reusable application answers (name, email, phone, location, links, work authorization, " +
        "sponsorship) and screening answers. Never equal-opportunity (EEO) answers. The user approves it on a card first.",
      inputSchema: ProfileDetailsInputSchema,
      execute: (input) => proposeProfileDetailsTool(ctx, input),
    }),
  };
}

/**
 * The streamText options for approvals: the toolApproval map and the secret, or nothing
 * at all when the secret is missing or the run is unattended (no approval tool exists then).
 */
export function approvalStreamOptions(ctx: Pick<ToolCtx, "unattended">):
  | { toolApproval: typeof TOOL_APPROVAL; experimental_toolApprovalSecret: string }
  | Record<string, never> {
  if (ctx.unattended) return {};
  const secret = approvalSecret();
  return secret === null ? {} : { toolApproval: TOOL_APPROVAL, experimental_toolApprovalSecret: secret };
}
