import { getUserClaims } from "@/lib/auth";
import { buildAccountExport } from "@/lib/accountExport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/account/export — one-click download of everything we hold on the caller
// (T2, spec subsystem E). Session-required (NOT in PUBLIC_PREFIXES); a fetch() wants a
// clean 401 JSON, not a redirect. The payload is a JSON attachment with no-store so it
// never lands in a shared cache.
export async function GET() {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in" }, { status: 401 });

  const data = await buildAccountExport(claims.id, claims.email);
  const body = JSON.stringify(data, null, 2);
  const filename = `rolefit-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
