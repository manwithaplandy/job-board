import { APICallError, RetryError } from "ai";

// What a failed model call tells us (PR K1). Production logged only the error's name, so a
// failing provider call (a bad key, no credits, a request shape the provider refuses) could
// not be told apart. This reads the HTTP status, whether the SDK would retry it, and the
// provider's own error message from the response body, for one log line and for a short
// reason code stored on the run (agent_runs.error) and sent to the browser.
//
// Nothing that can hold a secret is read: no request headers, no request body, no URL,
// no response headers. The provider's message is cut to MESSAGE_MAX characters, control
// characters are dropped and anything shaped like a key or bearer token is replaced.

export const MESSAGE_MAX = 300;

export interface ModelErrorDetails {
  /** The error's name, e.g. AI_APICallError (after unwrapping a retry). */
  name: string;
  /** The provider's HTTP status, when the call got a response. */
  status: number | null;
  /** Whether the SDK treats the error as retryable; null when it is not an API call error. */
  retryable: boolean | null;
  /** The provider's own error message, cleaned and cut, or null. */
  providerMessage: string | null;
  /** The provider's own error code (OpenRouter's error.code), when it is short and plain. */
  providerCode: string | null;
}

/** The last API call error inside a retry, or the error itself. */
function unwrap(error: unknown): unknown {
  let e = error;
  for (let depth = 0; depth < 3; depth++) {
    if (RetryError.isInstance(e)) {
      e = e.lastError;
      continue;
    }
    // streamText can surface the call's error as the cause of another SDK error.
    if (!APICallError.isInstance(e) && e instanceof Error && APICallError.isInstance(e.cause)) {
      e = e.cause;
      continue;
    }
    break;
  }
  return e;
}

// Key- and token-shaped strings: an OpenRouter or OpenAI style key, a bearer token, and
// any long unbroken run of key characters.
const SECRET_SHAPES = [/\bsk-[A-Za-z0-9_-]{6,}/g, /\bBearer\s+\S+/gi, /[A-Za-z0-9_\-+/=]{32,}/g];
// C0 and C1 control characters and bidi overrides, which could forge or reorder a log line.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g;

/** A provider message made safe to log: one line, no key-shaped text, at most MESSAGE_MAX characters. */
export function cleanProviderMessage(raw: string): string | null {
  let text = raw.replace(UNSAFE_CHARS, " ");
  for (const shape of SECRET_SHAPES) text = text.replace(shape, "[redacted]");
  text = text.replace(/\s+/g, " ").trim();
  if (text === "") return null;
  return text.length > MESSAGE_MAX ? `${text.slice(0, MESSAGE_MAX - 1)}…` : text;
}

function bodyRecord(body: string | undefined): Record<string, unknown> | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The provider's message and code from an error body. OpenRouter (and OpenAI-style APIs)
 * answer `{ "error": { "message": "...", "code": 402 } }`; a plain `{ "message": "..." }`
 * is read too. A body that is not JSON gives nothing: its raw text is not logged.
 */
function providerError(body: string | undefined): { message: string | null; code: string | null } {
  const record = bodyRecord(body);
  if (!record) return { message: null, code: null };
  const inner = record.error;
  const source = inner !== null && typeof inner === "object" && !Array.isArray(inner) ? (inner as Record<string, unknown>) : record;
  const message = typeof source.message === "string" ? cleanProviderMessage(source.message) : typeof inner === "string" ? cleanProviderMessage(inner) : null;
  const rawCode = source.code;
  const code =
    typeof rawCode === "number" && Number.isInteger(rawCode)
      ? String(rawCode)
      : typeof rawCode === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(rawCode)
        ? rawCode
        : null;
  return { message, code };
}

/** What a model error says, read without touching anything that could hold a secret. */
export function describeModelError(error: unknown): ModelErrorDetails {
  const e = unwrap(error);
  const name = e instanceof Error ? e.name : typeof e;
  if (!APICallError.isInstance(e)) return { name, status: null, retryable: null, providerMessage: null, providerCode: null };
  const status = typeof e.statusCode === "number" && Number.isInteger(e.statusCode) && e.statusCode >= 100 && e.statusCode <= 599 ? e.statusCode : null;
  const parsed = providerError(e.responseBody);
  return { name, status, retryable: e.isRetryable, providerMessage: parsed.message, providerCode: parsed.code };
}

/**
 * The run's reason code (agent_runs.error, at most 64 characters): `model_error`, or
 * `model_error:<status>` when the provider answered with an HTTP status.
 */
export function modelErrorCode(details: Pick<ModelErrorDetails, "status">): string {
  return details.status === null ? "model_error" : `model_error:${details.status}`;
}

/** The one log line for a failed model call. Every value is from describeModelError, so it holds no secret. */
export function modelErrorLogLine(where: string, details: ModelErrorDetails): string {
  const parts = [
    `agent: ${where}`,
    `name=${details.name}`,
    `status=${details.status ?? "none"}`,
    `retryable=${details.retryable ?? "unknown"}`,
  ];
  if (details.providerCode !== null) parts.push(`code=${details.providerCode}`);
  if (details.providerMessage !== null) parts.push(`provider=${JSON.stringify(details.providerMessage)}`);
  return parts.join(" ");
}
