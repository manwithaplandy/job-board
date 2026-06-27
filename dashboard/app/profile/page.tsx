import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile, getDistinctLocations } from "@/lib/queries";
import { extractPdfText } from "@/lib/pdf";
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
    companyInstructions: null, modelCompany: null,
  });
  redirect("/");
}

// Rolefit visual tokens — kept inline to match the sibling surfaces (Header, ProfileModal).
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f6fa",
  color: "#1f2430",
  padding: "40px 20px 64px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: "640px",
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #e7eaf0",
  borderRadius: "18px",
  boxShadow: "0 12px 40px rgba(15,22,35,.08)",
  padding: "30px 32px 32px",
};
const backLinkStyle: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#5b6472",
  textDecoration: "none",
};
const titleStyle: React.CSSProperties = {
  margin: "16px 0 4px",
  fontSize: "22px",
  fontWeight: 800,
  letterSpacing: "-.4px",
  color: "#161d29",
};
const subtitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#8a93a3",
  marginBottom: "22px",
};
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column" };
const labelTextStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#5b6472",
  marginBottom: "7px",
};
const hintStyle: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 500,
  color: "#9aa3b0",
  marginBottom: "8px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e3e7ee",
  borderRadius: "12px",
  padding: "13px",
  fontSize: "13px",
  lineHeight: 1.5,
  color: "#1f2430",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
};
const modelsCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  background: "#f9fbfd",
  border: "1px solid #e7eaf0",
  borderRadius: "14px",
  padding: "18px",
};
const modelsLegendStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#8a93a3",
};
const saveBtnStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  fontWeight: 700,
  fontSize: "13.5px",
  color: "#fff",
  background: "#3b6fd4",
  border: "none",
  borderRadius: "10px",
  padding: "11px 22px",
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(59,111,212,.26)",
};
const lastSavedStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#9aa3b0",
};

export default async function ProfilePage() {
  const userId = await requireUserId();
  const [profile, models, locations] = await Promise.all([
    getProfile(userId), getStructuredModels(), getDistinctLocations(),
  ]);
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <a href="/" style={backLinkStyle}>← Back</a>
        <h1 style={titleStyle}>Profile</h1>
        <div style={subtitleStyle}>
          Advanced settings — résumé, review models, and location preferences.
        </div>

        <form action={saveProfile} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <label style={fieldStyle}>
            <span style={labelTextStyle}>Résumé PDF</span>
            <span style={hintStyle}>Optional — overrides pasted text when it extracts cleanly.</span>
            <input
              name="resume_pdf"
              type="file"
              accept="application/pdf"
              style={{ fontSize: "13px", color: "#5b6472" }}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Résumé text</span>
            <textarea
              name="resume_text"
              rows={12}
              defaultValue={profile?.resume_text ?? ""}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Instructions (focus / avoid)</span>
            <textarea
              name="instructions"
              rows={4}
              defaultValue={profile?.instructions ?? ""}
              placeholder="e.g. focus on backend/infra; avoid pure-frontend roles"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <LocationPicker name="preferred_locations" options={locations}
            defaultValue={profile?.preferred_locations ?? []} />

          <div style={modelsCardStyle}>
            <div style={modelsLegendStyle}>
              Review models (leave blank to use the default: {DEFAULT_MODEL_ID})
            </div>
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
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button type="submit" style={saveBtnStyle}>Save</button>
            {profile && (
              <span style={lastSavedStyle}>
                Last saved {new Date(profile.updated_at).toLocaleString()} · version{" "}
                {profile.profile_version.slice(0, 8)}
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
