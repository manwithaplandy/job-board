export const NEW_WINDOW_HOURS = Number(process.env.NEW_WINDOW_HOURS ?? 48);
export const STALE_HEALTH_HOURS = 12;

// FR-10: the operator's default filter, applied on first load only.
export const DEFAULT_INCLUDE_KEYWORDS: string[] = ["engineer"];
