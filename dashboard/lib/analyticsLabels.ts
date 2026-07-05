// Plain-language glossary + label humanizer for the operator analytics page.
// Every gloss states MEANING and POLARITY ("high is normal", "lower is better")
// so a non-technical reader can tell whether a number is good or bad. Keep each
// gloss ≤ ~120 chars. Consumed by <InfoTip> (see components/analytics/InfoTip).

export interface GlossEntry { label: string; gloss: string }

export const GLOSSARY: Record<string, GlossEntry> = {
  "gate-rejected": {
    label: "Gate-rejected",
    gloss: "Filtered out by the cheap first-pass check because the job clearly doesn't fit. High numbers here are normal and save review cost.",
  },
  ingested: {
    label: "Ingested",
    gloss: "New candidate companies pulled in for classification. Higher just means more raw leads to sort through — neither good nor bad on its own.",
  },
  // Two distinct "backlog" meanings live on this page (see audit F4/R2-1).
  "backlog-state": {
    label: "Queued for (re)classification",
    gloss: "Discovery-found companies needing a first classification, or a re-run because your profile changed since they were last classified. The weekly run works through this queue; lower means it's caught up.",
  },
  "company-verdicts": {
    label: "Verdicts",
    gloss: "Counts every classified company, including a few you added by hand — so these can total slightly more than the discovery-only 'Classified' stage above.",
  },
  "backlog-run": {
    label: "Run-end backlog",
    gloss: "How many companies were still awaiting classification when the last run finished. Lower is better; 0 means fully caught up.",
  },
  ats: {
    label: "ATS",
    gloss: "Applicant Tracking System — the job-posting software a company uses (Greenhouse, Lever, Ashby…). We poll each ATS for open roles.",
  },
  "discovery-sourced": {
    label: "Found by discovery",
    gloss: "Companies the discovery pipeline found automatically (rather than ones added by hand).",
  },
  unknown: {
    label: "Unknown",
    gloss: "The classifier couldn't confidently decide include or exclude for this company — usually thin or unverifiable public data.",
  },
  "manual-reject": {
    label: "Manually rejected",
    gloss: "A job you rejected by hand, overriding the reviewer's approval. Counts toward denials.",
  },
  unreviewed: {
    label: "Not yet reviewed",
    gloss: "Open jobs the reviewer hasn't scored yet — the review backlog. Lower means the reviewer is keeping up with new postings.",
  },
  "inclusion-rate": {
    label: "Inclusion rate",
    gloss: "Share of newly classified companies accepted for tracking. Neither high nor low is inherently better — it reflects how selective the filter is.",
  },
  "approval-rate": {
    label: "Approval rate",
    gloss: "Share of reviewed jobs marked a fit. Naturally low — most postings aren't a match — so a small percentage here is expected.",
  },
  "gate-rate": {
    label: "Gate-reject rate",
    gloss: "Share of reviewed jobs the cheap first-pass check filters out before deep review. High is normal and by design.",
  },
  "failure-rate": {
    label: "Failure rate",
    gloss: "Share of companies whose ATS poll failed last run (timeouts, blocked, moved). Lower is better; the warn threshold is 60%.",
  },
  "run-cadence": {
    label: "Run cadence",
    gloss: "How many times each pipeline ran in the period. Should track its cron schedule; sudden drops can mean the cron stalled.",
  },
  "run-time": {
    label: "Run time",
    gloss: "Average wall-clock time one run took. Useful for spotting slowdowns; magnitudes differ a lot between pipelines.",
  },
  "credit-halt": {
    label: "Credit halt",
    gloss: "Times the discovery pipeline paused because the LLM provider ran out of credits. 0 is the healthy state.",
  },
  applied: {
    label: "Applied",
    gloss: "Jobs you've submitted an application to. The end of the funnel — higher means more of the approved matches converted to applications.",
  },
  denied: {
    label: "Denied",
    gloss: "Jobs the reviewer scored as not a fit after full review. Expected to dwarf approvals.",
  },
  approved: {
    label: "Approved matches",
    gloss: "Open jobs the reviewer scored as a genuine fit for your profile — the shortlist worth applying to.",
  },
  reviewed: {
    label: "Reviewed",
    gloss: "Open jobs the reviewer has scored for fit. Scope varies by widget — see each section's caption.",
  },
  excluded: {
    label: "Excluded",
    gloss: "Companies the classifier decided not to track (wrong industry, non-tech, unverifiable, etc.). High is normal — it keeps the board relevant.",
  },
  included: {
    label: "Included",
    gloss: "Companies accepted for tracking — we poll their ATS for open jobs.",
  },
  errors: {
    label: "Errors",
    gloss: "Individual items that threw an error during processing. Small counts are routine; a spike is worth investigating.",
  },
};

// Small override map for enum labels that don't Title-Case cleanly, plus a couple
// of jargon expansions. Everything else falls through to snake_case → Title Case.
const OVERRIDES: Record<string, string> = {
  software_internet: "Software / Internet",
  fintech_finance: "Fintech / Finance",
  services_other: "Services (other)",
  public_education: "Public education",
  healthcare_biotech: "Healthcare / Biotech",
  hardware_devices: "Hardware / Devices",
  ecommerce_retail: "E-commerce / Retail",
  media_entertainment: "Media / Entertainment",
  far_reach: "Far reach (stretch)",
  step_down: "Step down",
  lateral: "Lateral",
  // discovery_source enum ('manual','seed','dataset','expansion'). "dataset" (bulk import)
  // and "seed" (the hand-curated seed set) are distinct sources — the old shared "Seed …"
  // wording made them indistinguishable (audit R5-P4).
  dataset: "Dataset import",
  seed: "Seed companies",
  expansion: "Discovery expansion",
  manual: "Added manually",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
  on_site: "On-site",
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

// Known-brand casing for company slugs. A bare slug title-cased blindly fabricates
// wrong-looking names for known brands (openai → "Openai") and awkward run-ons for
// compound slugs. This map fixes the ones we recognise; everything else falls back to
// titleCaseSlug and the raw slug stays available as the hover title (audit R3-P3).
const COMPANY_OVERRIDES: Record<string, string> = {
  openai: "OpenAI",
  gopuff: "Gopuff",
  insomniacookies: "Insomnia Cookies",
  equipmentsharecom: "EquipmentShare",
  blueskytelepsych: "BlueSky TelePsych",
  github: "GitHub",
  gitlab: "GitLab",
  youtube: "YouTube",
  doordash: "DoorDash",
  paypal: "PayPal",
  lifestance: "LifeStance",
  boxlunch: "BoxLunch",
};

/** Split a slug on separators and Title-Case each token. */
function titleCaseSlug(slug: string): string {
  return slug
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Company slug → display name, honouring a known-brand override map. */
export function companyLabel(slug: string): string {
  if (slug == null) return "";
  const key = String(slug).trim().toLowerCase();
  if (key === "") return "";
  return COMPANY_OVERRIDES[key] ?? titleCaseSlug(slug);
}

// Casing for tech-tag display. Tags arrive lowercased ("ai", "aws", "machine learning");
// blind Title-Case gives "Ai"/"Aws". Map known acronyms/brands; Title-Case the rest so
// the tech-tags card matches the humanized labels elsewhere (audit R5-P3).
const TECH_TAG_CASING: Record<string, string> = {
  ai: "AI", ml: "ML", nlp: "NLP", llm: "LLM", llms: "LLMs",
  aws: "AWS", gcp: "GCP", sql: "SQL", api: "API", apis: "APIs",
  css: "CSS", html: "HTML", ios: "iOS", sdk: "SDK", ui: "UI", ux: "UX",
  devops: "DevOps", mlops: "MLOps", saas: "SaaS", "ci/cd": "CI/CD",
  javascript: "JavaScript", typescript: "TypeScript", graphql: "GraphQL",
  postgresql: "PostgreSQL", nodejs: "Node.js", "node js": "Node.js", ".net": ".NET",
};

/** Tech-tag slug/label → display casing (known acronyms preserved, else Title Case). */
export function techTagLabel(raw: string): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (key === "") return "";
  if (TECH_TAG_CASING[key]) return TECH_TAG_CASING[key];
  return key.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Reviewer-extraction charts only (approvals-by-seniority, work-arrangement): "unknown"
 *  is the model abstaining, not a company verdict — render it as "Not specified". Keep the
 *  bar (it's a coverage signal). Scoped helper, NOT humanizeLabel/GLOSSARY.unknown, which
 *  must keep the company-status "Unknown" meaning (plan phase J4). */
export const notSpecified = (bars: { label: string; count: number }[]) =>
  bars.map((b) => (b.label.toLowerCase() === "unknown" ? { ...b, label: "Not specified" } : b));

/** snake_case / lowercase enum → human Title Case, with a small override map. */
export function humanizeLabel(raw: string): string {
  if (raw == null) return "";
  const key = String(raw).trim();
  if (key === "") return "";
  const lower = key.toLowerCase();
  if (OVERRIDES[lower]) return OVERRIDES[lower];
  // Already looks human (has spaces or mixed case) → leave as-is.
  if (/\s/.test(key) || /[A-Z]/.test(key)) return key;
  return key
    .split(/[_\-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
