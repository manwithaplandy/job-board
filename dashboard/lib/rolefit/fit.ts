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
    textOn: L > 0.72 ? "#2a2410" : "#ffffff",
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
    return `${cur}${j.pay_min ?? "?"}–${j.pay_max ?? "?"}/hr`;
  }
  const k = (n: number | null) => (n == null ? "?" : `${Math.round(n / 1000)}k`);
  return `${cur}${k(j.pay_min)}–${k(j.pay_max)}`;
}

export function fmtPosted(firstSeenIso: string, nowIso: string): string {
  const days = Math.floor(
    (new Date(nowIso).getTime() - new Date(firstSeenIso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
