// Single source of truth for the LangFuse base URL.
//
// Why this exists: Vercel stored LANGFUSE_HOST as an empty string (""), not
// undefined. Call sites read `process.env.LANGFUSE_HOST ?? default` — but
// `"" ?? default` is "", so the empty string was handed to the SDK as the
// base URL and every request failed at the connection layer with
// `fetch failed` (statusCode undefined). This silently broke both the
// resume-golden dataset sync AND OTel trace export from Vercel.
//
// Treat empty/whitespace-only as unset, and default to the US cloud region,
// which is where this project's LangFuse data lives (traces + datasets). A
// caller that needs a different region sets LANGFUSE_HOST explicitly.
export const DEFAULT_LANGFUSE_HOST = "https://us.cloud.langfuse.com";

export function resolveLangfuseHost(
  raw: string | undefined = process.env.LANGFUSE_HOST,
): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_LANGFUSE_HOST;
}
