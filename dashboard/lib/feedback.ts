export const FEEDBACK_MAX_LENGTH = 4000;
export type FeedbackKind = "issue" | "criticism" | "feature_request";
export interface FeedbackInput { kind: FeedbackKind; message: string }
export type FeedbackResult = { ok: true } | { ok: false; error: string };

export function parseFeedback(value: unknown): FeedbackInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("kind" in value) || !("message" in value)) return null;
  const { kind, message } = value;
  if (kind !== "issue" && kind !== "criticism" && kind !== "feature_request") return null;
  if (typeof message !== "string" || message.length > FEEDBACK_MAX_LENGTH || message.includes("\0")) return null;
  const trimmed = message.trim();
  return trimmed ? { kind, message: trimmed } : null;
}
