import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
  let resumeText = (String(formData.get("resume_text") ?? "")).trim() || null;
  let resumeFilePath: string | null = null;

  const file = formData.get("resume_pdf");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${userId}/${Date.now()}-${file.name}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`resume upload failed: ${error.message}`);
    resumeFilePath = path;
    const extracted = await extractPdfText(bytes);
    if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
  }

  await upsertProfile(userId, { resumeText, instructions, resumeFilePath });
}

export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  return (
    <main className="mx-auto mt-12 max-w-2xl px-6">
      <h1 className="text-lg font-semibold">Profile</h1>
      <form action={saveProfile} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col text-sm text-gray-700">
          Resume PDF (optional — overrides pasted text when it extracts cleanly)
          <input name="resume_pdf" type="file" accept="application/pdf" className="mt-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Resume text
          <textarea name="resume_text" rows={12} defaultValue={profile?.resume_text ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm text-gray-700">
          Instructions (focus / avoid)
          <textarea name="instructions" rows={4} defaultValue={profile?.instructions ?? ""}
            className="mt-1 rounded border px-2 py-1 text-sm"
            placeholder="e.g. focus on backend/infra; avoid pure-frontend roles" />
        </label>
        <button type="submit"
          className="self-start rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
          Save
        </button>
        {profile && (
          <p className="text-xs text-gray-500">
            Last saved {new Date(profile.updated_at).toLocaleString()} · version{" "}
            {profile.profile_version.slice(0, 8)}
          </p>
        )}
      </form>
    </main>
  );
}
