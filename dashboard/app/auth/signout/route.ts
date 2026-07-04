import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 (not the default 307) so the browser GETs /login instead of re-POSTing it —
  // same pattern as app/auth/confirm/route.ts.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
