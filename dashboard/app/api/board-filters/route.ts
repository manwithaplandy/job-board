import { cookies } from "next/headers";
import { getUserId } from "@/lib/auth";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters, serializeBoardFilters } from "@/lib/rolefit/boardFilters";

const COOKIE = "board_filters";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

// The ANON visitor's persisted filters from the httpOnly cookie. The ISR public board
// (/board) is edge-cached identically for every anon visitor, so the per-visitor cookie
// can't influence its server render — the client fetches the saved state here after
// mount instead. Authed boards never call this (filters come from profiles.board_filters
// in the dynamic render). Total-parsed: an absent/corrupt cookie yields defaults.
export async function GET(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return Response.json({ error: "forbidden" }, { status: 403 });
  const store = await cookies();
  return Response.json(parseBoardFilters(store.get(COOKIE)?.value), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return Response.json({ error: "forbidden" }, { status: 403 });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Malformed body → parseBoardFilters yields defaults.
  }

  try {
    const filters = parseBoardFilters(body);
    const userId = await getUserId();
    if (userId) {
      await saveBoardFilters(userId, filters);
    } else {
      const store = await cookies();
      store.set(COOKIE, serializeBoardFilters(filters), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE,
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    // Best-effort: never block filtering on a persistence failure.
    console.error("board-filters save failed", e);
    return Response.json({ ok: false }, { status: 200 });
  }
}
