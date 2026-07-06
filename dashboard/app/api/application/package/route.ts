import { getUserClaims } from "@/lib/auth";
import { getApplicationPackage } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Single-package fetch for the async generation flow: when the poller reports a
// generation 'ready', the board reloads THIS job's persisted package to refresh
// its panes (the old blocking POSTs returned the package inline; the 202 bodies
// don't). Same { package } shape as those POSTs so the client codepaths agree.
export async function GET(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const pkg = await getApplicationPackage(claims.id, jobId);
  if (!pkg) return Response.json({ error: "package not found" }, { status: 404 });
  return Response.json({ package: pkg });
}
