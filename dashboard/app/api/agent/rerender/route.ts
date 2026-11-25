import { z } from "zod";
import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { AccountDeletedError, assertNotDeleted } from "@/lib/tombstone";
import { loadAppSettings } from "@/lib/appSettings";
import { checkBudget } from "@/lib/agent/budget";
import { rerenderSurface } from "@/lib/agent/rerender";

export const dynamic = "force-dynamic";
// The re-render's own wall clock is AGENT_LIMITS.wallClockMs (240 s).
export const maxDuration = 300;

// "Re-render as" (plan Task 2.9): one of the caller's surfaces again, from the same data,
// in another variant. Authed only: NOT in PUBLIC_PREFIXES. The gates and their statuses are
// /api/agent's contract, in the same order:
//   403 { error: "forbidden" }              Sec-Fetch-Site is cross-site or same-site
//   401 no session (or an erased account's stale JWT)
//   400 { error: "bad_request" }            not application/json, the body fails the strict
//                                           schema, or variant 3 while it is switched off
//   402 { error: "subscription_required" }  no plan
//   503 { error: "agent_disabled" }         the kill switch (fails closed on a failed read)
//   429 { error: "agent_budget_exhausted", reason }  a ceiling is reached
//   404 { error: "not_found" }              no such surface for this user
// and 500 { error: "rerender_failed" } when the model call stored no surface. The user id
// comes only from the session; the body cannot carry one (the schema is strict).

const BODY_MAX_CHARS = 1_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RerenderRequestSchema = z
  .object({
    surfaceId: z.string().regex(UUID_RE),
    variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();
type RerenderRequest = z.infer<typeof RerenderRequestSchema>;

const json = (body: unknown, status: number) => Response.json(body, { status });
const badRequest = () => json({ error: "bad_request" }, 400);

async function readBody(req: Request): Promise<RerenderRequest | null> {
  // JSON only: a cross-site form cannot send application/json without a preflight.
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
  const parsed = RerenderRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function POST(req: Request): Promise<Response> {
  // This route spends money, so a cross-site or sibling-subdomain request is refused first.
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
  // Variant 3 is refused while the operator switch is off, before any spend.
  if (body.variant === 3 && !settings.agentVariant3Enabled) return badRequest();
  const budget = await checkBudget(userId);
  if (!budget.ok) {
    if (budget.reason === "agent_disabled") return json({ error: "agent_disabled" }, 503);
    return json({ error: "agent_budget_exhausted", reason: budget.reason }, 429);
  }

  const out = await rerenderSurface(userId, {
    surfaceId: body.surfaceId,
    variant: body.variant,
    email: claims.email,
    variant3Enabled: settings.agentVariant3Enabled,
  });
  if (out.ok) return json({ surfaceId: out.surface.id, threadId: out.surface.threadId, variant: out.surface.variant }, 200);
  if (out.reason === "not_found") return json({ error: "not_found" }, 404);
  if (out.reason === "variant3_off") return badRequest();
  if (out.reason === "budget") {
    if (out.budget.reason === "agent_disabled") return json({ error: "agent_disabled" }, 503);
    return json({ error: "agent_budget_exhausted", reason: out.budget.reason }, 429);
  }
  return json({ error: "rerender_failed" }, 500);
}
