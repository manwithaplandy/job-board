import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { resolveStage2Model, CHEAP_MODEL, PREMIUM_MODEL } from "@/lib/entitlements";
import { internalPathFromReferer } from "@/lib/paths";
import { ProfileFormShell, type ProfileSaveState } from "@/components/ProfileFormShell";
import { createClient } from "@/lib/supabase/server";
import { getProfile, upsertProfile, getDistinctLocations } from "@/lib/queries";
import {
  getStructuredModels, CURATED_MODELS, DEFAULT_MODEL_ID, validateModelId,
} from "@/lib/openrouter";
import { ModelPicker } from "@/components/ModelPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { parsePreferredLocations } from "@/lib/preferredLocations";
import { safeErrorMessage } from "@/lib/safeError";
import { assertNotDeleted } from "@/lib/tombstone";
import { resumeObjectPath } from "@/lib/resumeStorage";
import { DEFAULT_RESUME_MODEL } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL } from "@/lib/rolefit/coverLetterClient";
import { ResumeUploadField } from "@/components/rolefit/ResumeUploadField";
import { DangerZone } from "@/components/account/DangerZone";
import { AppearanceToggle } from "@/components/theme/AppearanceToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · Rolefit" };

// getDistinctLocations() seq-scans ~115k open jobs (~100ms + cross-region RTT)
// on every profile load, but the distinct-location option set changes slowly.
// Cache it across requests so the page doesn't pay that scan each time; the
// LocationPicker options being a few minutes stale is harmless. The userId arg
// is only there so the read runs under the viewer's authenticated RLS context
// (jobs is shared-read, so the result is identical for every user — the per-user
// cache entries are just redundant copies of the same global option set).
const cachedDistinctLocations = unstable_cache(
  (userId: string) => getDistinctLocations(userId),
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
    const claims = await getUserClaims();
    if (!claims) redirect("/login");
    const userId = claims.id;
    // M-RESURRECT: a deleted user's JWT stays valid ≤1h. This full-form save uploads a
    // résumé PDF to storage before upsertProfile, so guard here (like the board modal's
    // saveProfileResume) — an erased account must not re-create stored data via a stale
    // JWT. Throws → caught below → surfaced as a generic form error.
    await assertNotDeleted(userId);
    const existing = await getProfile(userId);
    const instructions = (String(formData.get("instructions") ?? "")).trim() || null;
    const submittedText = (String(formData.get("resume_text") ?? "")).trim();
    const resumeText = submittedText || existing?.resume_text || null;

    const catalogIds = (await getStructuredModels()).map((m) => m.id);
    // An empty/missing value coerces to "" which validateModelId treats as "use default" (null).
    const s2 = validateModelId(String(formData.get("model_stage2") ?? ""), catalogIds);
    const r = validateModelId(String(formData.get("model_resume") ?? ""), catalogIds);
    const companyInstructions =
      (String(formData.get("company_instructions") ?? "")).trim() || null;
    const mc = validateModelId(String(formData.get("model_company") ?? ""), catalogIds);
    const cl = validateModelId(String(formData.get("model_cover") ?? ""), catalogIds);
    if (!s2.ok) return { error: s2.reason };
    if (!r.ok) return { error: r.reason };
    if (!mc.ok) return { error: mc.reason };
    if (!cl.ok) return { error: cl.reason };

    // Tier-gate the stage-2 review model: it must be one the viewer's plan entitles
    // (Standard/comped → cheap only; Pro → cheap or premium). This mirrors the
    // reviewer's hard fallback (T8) so a user never saves a model that would be
    // silently ignored at review time. Empty (= default cheap gate) always passes.
    // model_stage1 is NOT read — the reviewer forces the cheap gate regardless, so it
    // is no longer a user knob (the picker was removed from the form below).
    const plan = await getViewerPlan(userId, claims.email);
    if (s2.value && resolveStage2Model(plan, s2.value) !== s2.value) {
      const name = s2.value === PREMIUM_MODEL ? "Haiku 4.5" : s2.value;
      return { error: `${name} requires the Pro plan.` };
    }

    const preferredLocations = parsePreferredLocations(
      String(formData.get("preferred_locations") ?? ""),
    );
    // Mandatory location filter (spec's #1 cost lever): enforced on edit too, so a
    // user can't onboard with a location and then clear it back to an unbounded pool.
    if (preferredLocations.length === 0) {
      return { error: "Pick at least one location to include — this is required." };
    }

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

    // The uploaded file is archived only — the client already extracted it into
    // the résumé textarea and that reviewed text (resume_text) is the single
    // source generation reads. Save no longer re-extracts or resolves a path.
    let resumeFilePath = existing?.resume_file_path ?? null;
    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = resumeObjectPath(userId, file.name);
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
      if (error) return { error: safeErrorMessage("profile.resume-upload", error, "Résumé upload failed. Please try again.") };
      resumeFilePath = path; // archival only — generation reads resume_text
    }

    await upsertProfile(userId, {
      resumeText, instructions, resumeFilePath,
      // Stage-1 is always the cheap gate (reviewer forces it), so persist null — no
      // user knob. Stage-2 is tier-gated above.
      modelStage1: null, modelStage2: s2.value,
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
    return { error: safeErrorMessage("profile.save", e, "Save failed. Please try again.") };
  }
  redirect(returnTo);
}

// Rolefit visual tokens — kept inline to match the sibling surfaces (Header, ProfileModal).
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-page)",
  color: "var(--text-primary)",
  padding: "40px 20px 64px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: "640px",
  margin: "0 auto",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "18px",
  boxShadow: "0 12px 40px rgba(15,22,35,.08)",
  padding: "30px 32px 32px",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "22px",
  fontWeight: 800,
  letterSpacing: "-.4px",
  color: "var(--text-primary)",
};
const subtitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: "22px",
};
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column" };
const labelTextStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "7px",
};
const hintStyle: React.CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: "8px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "13px",
  fontSize: "13px",
  lineHeight: 1.5,
  color: "var(--text-primary)",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "var(--bg-surface)",
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
  background: "var(--bg-muted)",
  border: "1px solid var(--border)",
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
  background: "var(--bg-muted)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "18px",
};
const modelsLegendStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
};
const lastSavedStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-secondary)",
};

export default async function ProfilePage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const [profile, models, locations, plan] = await Promise.all([
    getProfile(userId), getStructuredModels(), cachedDistinctLocations(userId),
    getViewerPlan(userId, claims?.email ?? null),
  ]);
  const isPro = plan === "pro";
  const stage2Hint = isPro
    ? "Cheap gate is always used for stage 1. Stage 2: DeepSeek (cheap) or Haiku 4.5 (premium)."
    : "Cheap gate is always used for stage 1. Stage 2 is DeepSeek (cheap) — Haiku 4.5 requires Pro.";
  // Capture where the user came from now — the save POST's referer will be /profile.
  const hdrs = await headers();
  const returnTo = internalPathFromReferer(hdrs.get("referer"), hdrs.get("host") ?? "");
  return (
    <>
    <SlimHeader current="profile" />
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Profile</h1>
        <div style={subtitleStyle}>
          Advanced settings — résumé, review models, and location preferences.{" "}
          <a href="/billing" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Billing &amp; plan →
          </a>
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
            <span style={hintStyle}>Optional — extracts into the résumé text below for you to review before saving.</span>
            <ResumeUploadField textareaId="profile-resume-text" />
          </label>

          <label style={fieldStyle}>
            <span style={labelTextStyle}>Résumé text</span>
            <textarea
              id="profile-resume-text"
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
              Review models (leave blank to use the default: {CHEAP_MODEL})
            </div>
            {/* Stage 1 is the always-on cheap gate (the reviewer forces it), so it is
                no longer a user-selectable knob — shown read-only for transparency. */}
            <div style={fieldStyle}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Stage 1 — title/company gate
              </span>
              <span style={hintStyle}>Always the cheap model ({CHEAP_MODEL}) — not configurable.</span>
            </div>
            <ModelPicker
              label={`Stage 2 — full job-description review${isPro ? "" : " (Standard: cheap only)"}`}
              name="model_stage2" models={models} curated={CURATED_MODELS}
              defaultValue={profile?.model_stage2 ?? null} placeholder={CHEAP_MODEL}
              hint={stage2Hint} />
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

        <DangerZone />
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>Appearance</h2>
        <div style={subtitleStyle}>Choose how Rolefit looks on this device.</div>
        <AppearanceToggle />
        <div style={{ ...hintStyle, marginTop: 12 }}>
          System follows your device and updates live; Light or Dark pin an override. Saved on this device.
        </div>
      </div>
    </main>
    </>
  );
}
