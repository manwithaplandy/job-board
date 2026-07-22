import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listClassificationJobs } from "@/lib/classificationJobs";

export const dynamic = "force-dynamic";

// Admin poll endpoint for the /admin/classification launcher + monitor. The jobs panel
// polls this every 4s while a job is pending/running (cache: "no-store"). It mirrors
// the page's notFound() posture: a non-admin (or anon) caller gets a bare 404, never
// job data. NOT in PUBLIC_PREFIXES (lib/paths.ts) — the auth proxy 307s anon callers
// to /login before they reach here; an authed non-admin is 404'd here.
export async function GET() {
  if (!isAdmin(await getUserClaims())) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ jobs: await listClassificationJobs(20) });
}
