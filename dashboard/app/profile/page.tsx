import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile, getDistinctLocations } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
import { internalPathFromReferer } from "@/lib/paths";
import {
  getStructuredModels, CURATED_MODELS, DEFAULT_MODEL_ID, validateModelId,
} from "@/lib/openrouter";
import { ModelPicker } from "@/components/ModelPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { parsePreferredLocations } from "@/lib/preferredLocations";
import { DEFAULT_RESUME_MODEL } from "@/lib/rolefit/resumeClient";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
  let resumeText = (String(formData.get("resume_text") ?? "")).trim() || null;
  let resumeFilePath: string | null = null;

  // Return the user to where they came from (carried through the form). Re-check it here since the
  // hidden field is client-controlled: only same-origin paths are allowed, never an external URL.
  const next = String(formData.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const catalogIds = (await getStructuredModels()).map((m) => m.id);
  // An empty/missing value coerces to "" which validateModelId treats as "use default" (null).
  const s1 = validateModelId(String(formData.get("model_stage1") ?? ""), catalogIds);
  const s2 = validateModelId(String(formData.get("model_stage2") ?? ""), catalogIds);
  const r = validateModelId(String(formData.get("model_resume") ?? ""), catalogIds);
  if (!s1.ok) throw new Error(s1.reason);
  if (!s2.ok) throw new Error(s2.reason);
  if (!r.ok) throw new Error(r.reason);

  const preferredLocations = parsePreferredLocations(
    String(formData.get("preferred_locations") ?? ""),
  );

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

  await upsertProfile(userId, {
    resumeText, instructions, resumeFilePath,
    modelStage1: s1.value, modelStage2: s2.value,
    preferredLocations, modelResume: r.value,
  });
  redirect(safeNext);
}

export default async function ProfilePage() {
  const userId = await requireUserId();
  const [profile, models, locations, headerList] = await Promise.all([
    getProfile(userId), getStructuredModels(), getDistinctLocations(), headers(),
  ]);
  const back = internalPathFromReferer(headerList.get("referer"), headerList.get("host") ?? "");
  return (
    <main className="mx-auto mt-12 max-w-2xl px-6">
      <div className="flex items-center gap-3">
        <a href={back} className="text-sm text-blue-700 hover:underline">← Back</a>
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>
      <form action={saveProfile} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="next" value={back} />
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

        <LocationPicker name="preferred_locations" options={locations}
          defaultValue={profile?.preferred_locations ?? []} />

        <fieldset className="flex flex-col gap-3 rounded border p-3">
          <legend className="px-1 text-xs text-gray-500">
            Review models (leave blank to use the default: {DEFAULT_MODEL_ID})
          </legend>
          <ModelPicker
            label="Stage 1 — cheap title/company gate"
            name="model_stage1" models={models} curated={CURATED_MODELS}
            defaultValue={profile?.model_stage1 ?? null} placeholder={DEFAULT_MODEL_ID} />
          <ModelPicker
            label="Stage 2 — full job-description review"
            name="model_stage2" models={models} curated={CURATED_MODELS}
            defaultValue={profile?.model_stage2 ?? null} placeholder={DEFAULT_MODEL_ID} />
          <ModelPicker
            label="Résumé generation model"
            name="model_resume" models={models} curated={CURATED_MODELS}
            defaultValue={profile?.model_resume ?? null} placeholder={DEFAULT_RESUME_MODEL} />
        </fieldset>

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
