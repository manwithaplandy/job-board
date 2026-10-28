import { getUserClaims } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { isInvitedUser } from "@/lib/invites";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { resumePdfError } from "@/lib/profileInputLimits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to upload a résumé" }, { status: 401 });
  // Parsing is local (no LLM call), but it is CPU work on an uploaded file, so it's gated the same way as onboarding: the caller must
  // be invited (invite_redemptions) OR already have a profile. A direct-API account
  // that skipped /signup can authenticate but can't spend budget here.
  const invited = claims.email ? await isInvitedUser(claims.email) : false;
  if (!invited && !(await getProfile(claims.id))) {
    return Response.json({ error: "your account isn't set up yet" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "no file provided" }, { status: 400 });
  }
  const pdfError = resumePdfError(file);
  if (pdfError) return Response.json({ error: pdfError }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const markdown = await fileToResumeMarkdown(bytes, "pdf");
  if (!markdown) return Response.json({ error: "could not read that file" }, { status: 422 });
  return Response.json({ markdown });
}
