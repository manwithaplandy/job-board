import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { AccountDeletedError, assertNotDeleted } from "@/lib/tombstone";
import { loadAppSettings } from "@/lib/appSettings";
import { checkBudget } from "@/lib/agent/budget";
import { getThread } from "@/lib/agent/threads";
import { TurnInProgressError } from "@/lib/agent/runs";
import { streamAgentTurn, TurnInputError, type TurnInput } from "@/lib/agent/loop";
import { AgentRequestSchema, type AgentRequest } from "@/lib/agent/request";

export const dynamic = "force-dynamic";
// The turn's own wall clock is 240 s (AGENT_LIMITS.wallClockMs); persistence runs in
// after() on top of it.
export const maxDuration = 300;

// One agent turn (plan Task 0.13), streamed as a UI message stream. Authed only: NOT in
// PUBLIC_PREFIXES. The gates run in the order of the status contract:
//   403 { error: "forbidden" }              Sec-Fetch-Site is cross-site or same-site
//   401 no session (or an erased account's stale JWT)
//   400 { error: "bad_request" }            not application/json, or the body fails the strict schema
//   402 { error: "subscription_required" }  no plan
//   503 { error: "agent_disabled" }         the kill switch (fails closed on a failed read)
//   429 { error: "agent_budget_exhausted", reason }  a ceiling is reached
//   404 { error: "not_found" }              no such thread for this user
//   409 { error: "turn_in_progress" }       a live turn already runs on the thread
// The user id comes only from the server session; the body cannot carry one (the
// schema is strict). checkBudget is only the advisory pre-check: every step is charged
// under the per-user lock in lib/agent/runs.ts, which stops a turn at the ceiling.

// A valid body is at most ~8.4 KB of JSON; anything far larger is refused unread.
const BODY_MAX_CHARS = 64_000;

const json = (body: unknown, status: number) => Response.json(body, { status });
const badRequest = () => json({ error: "bad_request" }, 400);

async function readBody(req: Request): Promise<AgentRequest | null> {
  // JSON only. A cross-site HTML form can post text/plain or urlencoded with no
  // preflight; application/json cannot be sent cross-origin without one.
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return null;
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_MAX_CHARS) return null;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (text.length > BODY_MAX_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  // A total parse, but not parseOrNull: that unwraps a double-encoded jsonb string,
  // which an HTTP body has no reason to be.
  const parsed = AgentRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function toTurnInput(body: AgentRequest): TurnInput {
  if (body.kind === "approval") return { kind: "approval", approvalId: body.approvalId, approved: body.approved };
  return { kind: "message", id: body.id, text: body.text, documentIds: body.documentIds ?? [] };
}

export async function POST(req: Request): Promise<Response> {
  // The same-origin guard of app/auth/signout and app/api/board-filters: this route
  // spends money, so a cross-site or sibling-subdomain request is refused first.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return json({ error: "forbidden" }, 403);

  const claims = await getUserClaims();
  if (!claims) return json({ error: "sign in" }, 401);
  const userId = claims.id;
  try {
    await assertNotDeleted(userId);
  } catch (e) {
    if (e instanceof AccountDeletedError) return json({ error: "sign in" }, 401);
    throw e;
  }

  const body = await readBody(req);
  if (!body) return badRequest();

  const plan = await getViewerPlan(userId, claims.email);
  if (!plan) return json({ error: "subscription_required" }, 402);

  // loadAppSettings never throws: a failed read yields the agent switched off.
  const settings = await loadAppSettings();
  if (!settings.agentEnabled) return json({ error: "agent_disabled" }, 503);
  const budget = await checkBudget(userId);
  if (!budget.ok) {
    if (budget.reason === "agent_disabled") return json({ error: "agent_disabled" }, 503);
    return json({ error: "agent_budget_exhausted", reason: budget.reason }, 429);
  }

  const thread = await getThread(userId, body.threadId);
  if (!thread) return json({ error: "not_found" }, 404);

  try {
    return await streamAgentTurn({ userId, email: claims.email, thread, input: toTurnInput(body) });
  } catch (e) {
    if (e instanceof TurnInProgressError) return json({ error: "turn_in_progress" }, 409);
    if (e instanceof TurnInputError) return badRequest();
    throw e;
  }
}
