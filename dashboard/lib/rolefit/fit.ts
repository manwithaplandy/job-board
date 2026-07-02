export interface FitColors {
  strong: string; textOn: string; tint: string; tintVivid: string; tintBorder: string;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// Ported verbatim from the design's DCLogic.fitColor: remap the realistic 48-96
// fit range across the full red->yellow->green oklch scale.
export function fitColor(fit: number): FitColors {
  const f = Math.max(0, Math.min(1, (fit - 48) / 48));
  const red = [0.635, 0.205, 27], yel = [0.85, 0.15, 92], grn = [0.66, 0.16, 150];
  let a, b, t;
  if (f < 0.5) { a = red; b = yel; t = f / 0.5; } else { a = yel; b = grn; t = (f - 0.5) / 0.5; }
  const L = lerp(a[0], b[0], t), C = lerp(a[1], b[1], t), H = lerp(a[2], b[2], t);
  return {
    strong: `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`,
    // The red→yellow→green scale bottoms out at L≈0.635 (the deny/low-fit reds), so a
    // 0.65 cutoff put white text on those mid-lightness backgrounds at ~2.8:1. Drop the
    // cutoff below the palette floor so every badge gets dark text (≥5:1); white text is
    // never the higher-contrast choice on this scale.
    textOn: L > 0.6 ? "#2a2410" : "#ffffff",
    tint: `oklch(0.975 ${Math.min(C, 0.026).toFixed(3)} ${H.toFixed(1)})`,
    tintVivid: `oklch(0.95 ${Math.min(C, 0.058).toFixed(3)} ${H.toFixed(1)})`,
    tintBorder: `oklch(0.905 ${Math.min(C, 0.05).toFixed(3)} ${H.toFixed(1)})`,
  };
}

export function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export interface PayLike {
  pay_min: number | null; pay_max: number | null;
  pay_currency: string | null; pay_period: string | null;
}

export function fmtPay(j: PayLike): string | null {
  if (j.pay_min == null && j.pay_max == null) return null;
  const cur = !j.pay_currency || j.pay_currency === "USD" ? "$" : `${j.pay_currency} `;
  if (j.pay_period === "hour") {
    if (j.pay_min != null && j.pay_max == null) return `From ${cur}${j.pay_min}/hr`;
    if (j.pay_max != null && j.pay_min == null) return `Up to ${cur}${j.pay_max}/hr`;
    return `${cur}${j.pay_min ?? "?"}–${j.pay_max ?? "?"}/hr`;
  }
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  if (j.pay_min != null && j.pay_max == null) return `From ${cur}${k(j.pay_min)}`;
  if (j.pay_max != null && j.pay_min == null) return `Up to ${cur}${k(j.pay_max)}`;
  return `${cur}${j.pay_min != null ? k(j.pay_min) : "?"}–${j.pay_max != null ? k(j.pay_max) : "?"}`;
}

export function fmtPosted(firstSeenIso: string, nowIso: string): string {
  const days = Math.floor(
    (new Date(nowIso).getTime() - new Date(firstSeenIso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// Verbatim port of reviewer/scoring.py::compute_fit — keep in lockstep with it.
// Deterministic overall fit (0-100) from the corrected sub-scores, so the board
// ring reflects a correction without a Python round-trip.
const FIT_WEIGHTS = { skills: 0.45, experience: 0.3, comp: 0.25 };
const EXPERIENCE_BONUS: Record<string, number> = {
  match: 4, step_down: 2, reach: -3, far_reach: -8,
};
const CONFIDENCE_BONUS: Record<string, number> = { high: 3, medium: 0, low: -5 };
const RED_FLAG_PENALTY = 3;
const RED_FLAG_PENALTY_CAP = 9;
const DENY_CAP = 58;

// Python's round() is round-half-to-even; JS Math.round is half-up. Match Python.
function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function computeFit(a: {
  skillsScore: number | null;
  experienceScore: number | null;
  compScore: number | null;
  experienceMatch: string | null;
  confidence: string | null;
  redFlags: string[];
  verdict: string | null;
}): number {
  const s = a.skillsScore ?? 0;
  const e = a.experienceScore ?? 0;
  const c = a.compScore ?? 0;
  let fit =
    FIT_WEIGHTS.skills * s + FIT_WEIGHTS.experience * e + FIT_WEIGHTS.comp * c;
  fit += EXPERIENCE_BONUS[a.experienceMatch ?? ""] ?? 0;
  fit += CONFIDENCE_BONUS[a.confidence ?? ""] ?? 0;
  fit -= Math.min(RED_FLAG_PENALTY_CAP, RED_FLAG_PENALTY * (a.redFlags?.length ?? 0));
  fit = roundHalfEven(Math.max(0, Math.min(100, fit)));
  if (a.verdict === "deny") fit = Math.min(fit, DENY_CAP);
  return fit;
}
