import { getUserId } from "@/lib/auth";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to upload a résumé" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "no file provided" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const markdown = await fileToResumeMarkdown(bytes, "pdf");
  if (!markdown) return Response.json({ error: "could not read that file" }, { status: 422 });
  return Response.json({ markdown });
}
