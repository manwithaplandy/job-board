import { getUserClaims } from "@/lib/auth";
import { listGenerationActivity } from "@/lib/generationJobs";

export const dynamic = "force-dynamic";

// Poll endpoint for the async generation flow: the viewer's pending
// generation_jobs rows plus rows settled within the recent window (so a client
// that was closed mid-generation still surfaces the completion on its next
// mount; the GenerationToastProvider de-dupes via localStorage). Deliberately
// NOT in PUBLIC_PREFIXES (lib/paths.ts): the auth proxy 307s anonymous callers
// to /login, which the provider detects (res.redirected) and stops polling.
export async function GET() {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });
  const generations = await listGenerationActivity(claims.id);
  return Response.json({ generations });
}
