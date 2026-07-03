import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { internalPathFromReferer } from "@/lib/paths";
import { ProfileFormShell, type ProfileSaveState } from "@/components/ProfileFormShell";
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
import { DEFAULT_COVER_MODEL } from "@/lib/rolefit/coverLetterClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · Rolefit" };

// getDistinctLocations() seq-scans ~115k open jobs (~100ms + cross-region RTT)
// on every profile load, but the distinct-location option set changes slowly.
// Cache it across requests so the page doesn't pay that scan each time; the
// LocationPicker options being a few minutes stale is harmless. No user arg —
// the option set is global.
const cachedDistinctLocations = unstable_cache(
  () => getDistinctLocations(),
  ["profile-distinct-locations"],
  { revalidate: 600 },
);

// "" → null, "yes" → true, "no" → false. Mirrors the tri-state work-eligibility select.
function parseTriState(v: FormDataEntryValue | null): boolean | null {
  const s = String(v ?? "");
  return s === "yes" ? true : s === "no" ? false : null;
}
const trimOrNull = (v: FormDataEntryValue | null): string | null =>
  String(v ?? "").trim() || null;
// boolean | null → the <select> value: true → "yes", false → "no", null → "".
const triDefault = (v: boolean | null | undefined): string =>
  v === true ? "yes" : v === false ? "no" : "";

async function saveProfile(_prev: ProfileSaveState, formData: FormData): Promise<ProfileSaveState> {
  "use server";
  // Guard against open redirects: only same-origin absolute paths are honored, anything
  // else falls back to the board. Computed after a successful save, used post-try.
  let returnTo = "/";
  try {
    const userId = await requireUserId();
    const existing = await getProfile(userId);
    const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
    let resumeText = (String(formData.get("resume_text") ?? "")).trim() || existing?.resume_text || null;
    // Preserve the previously-uploaded PDF: a file input is empty on every save
    // that doesn't re-pick the file, so defaulting to null here would wipe the
    // stored path. Only a fresh upload below replaces it.
    let resumeFilePath: string | null = existing?.resume_file_path ?? null;

    const catalogIds = (await getStructuredModels()).map((m) => m.id);
    // An empty/missing value coerces to "" which validateModelId treats as "use default" (null).
    const s1 = validateModelId(String(formData.get("model_stage1") ?? ""), catalogIds);
    const s2 = validateModelId(String(formData.get("model_stage2") ?? ""), catalogIds);
    const r = validateModelId(String(formData.get("model_resume") ?? ""), catalogIds);
    const companyInstructions =
      (String(formData.get("company_instructions") ?? "")).trim() || null;
    const mc = validateModelId(String(formData.get("model_company") ?? ""), catalogIds);
    const cl = validateModelId(String(formData.get("model_cover") ?? ""), catalogIds);
    if (!s1.ok) return { error: s1.reason };
    if (!s2.ok) return { error: s2.reason };
    if (!r.ok) return { error: r.reason };
    if (!mc.ok) return { error: mc.reason };
    if (!cl.ok) return { error: cl.reason };

    const preferredLocations = parsePreferredLocations(
      String(formData.get("preferred_locations") ?? ""),
    );

    // Reusable application answers. jsonb columns are stored as objects (NOT NULL).
    const links = {
      linkedin: trimOrNull(formData.get("link_linkedin")),
      github: trimOrNull(formData.get("link_github")),
      portfolio: trimOrNull(formData.get("link_portfolio")),
    };
    const screeningAnswers = {
      notice_period: trimOrNull(formData.get("screen_notice_period")),
      salary_expectation: trimOrNull(formData.get("screen_salary_expectation")),
      relocation: trimOrNull(formData.get("screen_relocation")),
    };

    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = `${userId}/${Date.now()}-${file.name}`;
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) return { error: `resume upload failed: ${error.message}` };
      resumeFilePath = path;
      const extracted = await extractPdfText(bytes);
      if (extracted) resumeText = extracted; // paste-text is the fallback when extraction is poor
    }

    await upsertProfile(userId, {
      resumeText, instructions, resumeFilePath,
      modelStage1: s1.value, modelStage2: s2.value,
      preferredLocations, modelResume: r.value,
      companyInstructions, modelCompany: mc.value,
      fullName: trimOrNull(formData.get("full_name")),
      email: trimOrNull(formData.get("email")),
      phone: trimOrNull(formData.get("phone")),
      links,
      location: trimOrNull(formData.get("location")),
      workAuthorized: parseTriState(formData.get("work_authorized")),
      needsSponsorship: parseTriState(formData.get("needs_sponsorship")),
      eeoGender: trimOrNull(formData.get("eeo_gender")),
      eeoRace: trimOrNull(formData.get("eeo_race")),
      eeoVeteran: trimOrNull(formData.get("eeo_veteran")),
      eeoDisability: trimOrNull(formData.get("eeo_disability")),
      screeningAnswers,
      modelCover: cl.value,
    });
    // Return to the page the user came from (threaded through a hidden field captured at
    // GET time — the POST's own referer is /profile).
    const rt = String(formData.get("return_to") ?? "/");
    // Reject protocol-relative ("//host") and backslash ("/\host", "\/host") forms —
    // browsers normalize "\" to "/", so either can escape to another origin.
    returnTo = rt.startsWith("/") && !rt.startsWith("//") && !rt.includes("\\") ? rt : "/";
  } catch (e) {
    // Re-throw Next control-flow (redirect/notFound, e.g. an expired session in
    // requireUserId); surface everything else inline so the form stays mounted.
    unstable_rethrow(e);
    return { error: (e as Error).message || "Save failed. Please try again." };
  }
  redirect(returnTo);
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
  color: "#6b7480",
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
  color: "#7a8494",
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
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#fff",
};
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
};
const detailsCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  background: "#f9fbfd",
  border: "1px solid #e7eaf0",
  borderRadius: "14px",
  padding: "18px",
};
const detailsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "16px",
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
  color: "#6b7480",
};
const lastSavedStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#9aa3b0",
};

export default async function ProfilePage() {
  const userId = await requireUserId();
  const [profile, models, locations] = await Promise.all([
    getProfile(userId), getStructuredModels(), cachedDistinctLocations(),
  ]);
  // Capture where the user came from now — the save POST's referer will be /profile.
  const hdrs = await headers();
  const returnTo = internalPathFromReferer(hdrs.get("referer"), hdrs.get("host") ?? "");
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <a href="/" style={backLinkStyle}>← Back</a>
        <h1 style={titleStyle}>Profile</h1>
        <div style={subtitleStyle}>
          Advanced settings — résumé, review models, and location preferences.
        </div>

        <ProfileFormShell
          action={saveProfile}
          lastSaved={profile ? (
            <span style={lastSavedStyle}>
              Last saved {new Date(profile.updated_at).toLocaleString()} · version{" "}
              {profile.profile_version.slice(0, 8)}
            </span>
          ) : undefined}
        >
          <input type="hidden" name="return_to" value={returnTo} />
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
              className="rf-focusable"
              name="resume_text"
              rows={12}
              defaultValue={profile?.resume_text ?? ""}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Instructions (focus / avoid)</span>
            <textarea
              className="rf-focusable"
              name="instructions"
              rows={4}
              defaultValue={profile?.instructions ?? ""}
              placeholder="e.g. focus on backend/infra; avoid pure-frontend roles"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Company preferences (include / exclude)</span>
            <span style={hintStyle}>
              Which companies to surface or skip — used by company discovery.
            </span>
            <textarea
              className="rf-focusable"
              name="company_instructions"
              rows={4}
              defaultValue={profile?.company_instructions ?? ""}
              placeholder="e.g. prefer devtools & AI infra; exclude defense; avoid legacy Java/C/C++ shops"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <LocationPicker name="preferred_locations" options={locations}
            defaultValue={profile?.preferred_locations ?? []} />

          {/* ── Application details ── reusable answers surfaced per-job in the board */}
          <div style={detailsCardStyle}>
            <div style={modelsLegendStyle}>
              Application details — reused across applications (copy buttons appear per role)
            </div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Full name</span>
                <input className="rf-focusable" name="full_name" defaultValue={profile?.full_name ?? ""}
                  placeholder="Jane Doe" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Location</span>
                <input className="rf-focusable" name="location" defaultValue={profile?.location ?? ""}
                  placeholder="San Francisco, CA" style={inputStyle} />
              </label>
            </div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Email</span>
                <input className="rf-focusable" name="email" type="email" defaultValue={profile?.email ?? ""}
                  placeholder="jane@example.com" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Phone</span>
                <input className="rf-focusable" name="phone" defaultValue={profile?.phone ?? ""}
                  placeholder="+1 555 123 4567" style={inputStyle} />
              </label>
            </div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>LinkedIn</span>
                <input className="rf-focusable" name="link_linkedin" defaultValue={profile?.links?.linkedin ?? ""}
                  placeholder="linkedin.com/in/…" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>GitHub</span>
                <input className="rf-focusable" name="link_github" defaultValue={profile?.links?.github ?? ""}
                  placeholder="github.com/…" style={inputStyle} />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelTextStyle}>Portfolio / website</span>
              <input className="rf-focusable" name="link_portfolio" defaultValue={profile?.links?.portfolio ?? ""}
                placeholder="https://…" style={inputStyle} />
            </label>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Authorized to work?</span>
                <select className="rf-focusable" name="work_authorized" defaultValue={triDefault(profile?.work_authorized)}
                  style={selectStyle}>
                  <option value="">Prefer not to say</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Need sponsorship?</span>
                <select className="rf-focusable" name="needs_sponsorship" defaultValue={triDefault(profile?.needs_sponsorship)}
                  style={selectStyle}>
                  <option value="">Prefer not to say</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Notice period</span>
                <input className="rf-focusable" name="screen_notice_period"
                  defaultValue={profile?.screening_answers?.notice_period ?? ""}
                  placeholder="2 weeks" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Salary expectation</span>
                <input className="rf-focusable" name="screen_salary_expectation"
                  defaultValue={profile?.screening_answers?.salary_expectation ?? ""}
                  placeholder="$180k–$210k" style={inputStyle} />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelTextStyle}>Open to relocation?</span>
              <input className="rf-focusable" name="screen_relocation"
                defaultValue={profile?.screening_answers?.relocation ?? ""}
                placeholder="e.g. Open to relocation for the right role" style={inputStyle} />
            </label>

            <div style={modelsLegendStyle}>Voluntary EEO self-identification (optional)</div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Gender</span>
                <input className="rf-focusable" name="eeo_gender" defaultValue={profile?.eeo_gender ?? ""}
                  placeholder="Prefer not to say" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Race / ethnicity</span>
                <input className="rf-focusable" name="eeo_race" defaultValue={profile?.eeo_race ?? ""}
                  placeholder="Prefer not to say" style={inputStyle} />
              </label>
            </div>
            <div style={detailsRowStyle}>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Veteran status</span>
                <input className="rf-focusable" name="eeo_veteran" defaultValue={profile?.eeo_veteran ?? ""}
                  placeholder="Prefer not to say" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelTextStyle}>Disability status</span>
                <input className="rf-focusable" name="eeo_disability" defaultValue={profile?.eeo_disability ?? ""}
                  placeholder="Prefer not to say" style={inputStyle} />
              </label>
            </div>
          </div>

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
            <ModelPicker
              label="Cover letter generation model"
              name="model_cover" models={models} curated={CURATED_MODELS}
              defaultValue={profile?.model_cover ?? null} placeholder={DEFAULT_COVER_MODEL} />
            <ModelPicker
              label="Company review model"
              name="model_company" models={models} curated={CURATED_MODELS}
              defaultValue={profile?.model_company ?? null} placeholder={DEFAULT_MODEL_ID} />
          </div>

        </ProfileFormShell>
      </div>
    </main>
  );
}
