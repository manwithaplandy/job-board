// What a failed model call is reduced to (PR K1): status, retryable and the provider's own
// message, with nothing that could hold a secret.
import { describe, expect, test } from "vitest";
import { APICallError, NoOutputGeneratedError, RetryError } from "ai";
import { MESSAGE_MAX, cleanProviderMessage, describeModelError, modelErrorCode, modelErrorLogLine } from "./modelError";

function callError(statusCode: number | undefined, responseBody: string | undefined, isRetryable = false): APICallError {
  return new APICallError({
    message: "provider said no",
    url: "https://openrouter.example/api/v1/chat/completions",
    requestBodyValues: { model: "x", messages: [{ role: "user", content: "private question" }] },
    statusCode,
    responseHeaders: { "set-cookie": "session=abc" },
    responseBody,
    isRetryable,
  });
}

describe("describeModelError", () => {
  test("reads the status, retryable and OpenRouter's error message and code", () => {
    const d = describeModelError(callError(401, JSON.stringify({ error: { message: "User not found.", code: 401 } })));
    expect(d).toEqual({ name: "AI_APICallError", status: 401, retryable: false, providerMessage: "User not found.", providerCode: "401", upstreamProvider: null, upstreamMessage: null });
  });

  test("a top-level message and a string code are read too", () => {
    const d = describeModelError(callError(400, JSON.stringify({ message: "Invalid cache_control", code: "invalid_request" })));
    expect(d.providerMessage).toBe("Invalid cache_control");
    expect(d.providerCode).toBe("invalid_request");
  });

  test("a body that is not JSON gives no provider message (its raw text is not logged)", () => {
    const d = describeModelError(callError(502, "<html>Bad gateway from upstream</html>", true));
    expect(d).toEqual({ name: "AI_APICallError", status: 502, retryable: true, providerMessage: null, providerCode: null, upstreamProvider: null, upstreamMessage: null });
  });

  test("OpenRouter's upstream provider and its raw error are read (Provider returned error)", () => {
    const raw = JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } });
    const body = JSON.stringify({ error: { message: "Provider returned error", code: 400, metadata: { raw, provider_name: "Anthropic" } } });
    const d = describeModelError(callError(400, body));
    expect(d.providerMessage).toBe("Provider returned error");
    expect(d.upstreamProvider).toBe("Anthropic");
    expect(d.upstreamMessage).toBe("Your credit balance is too low to access the Anthropic API.");
    expect(modelErrorLogLine("model stream error", d)).toBe(
      'agent: model stream error name=AI_APICallError status=400 retryable=false code=400 provider="Provider returned error" upstream_provider="Anthropic" upstream="Your credit balance is too low to access the Anthropic API."',
    );
  });

  test("a raw upstream error that is not JSON is cleaned, and a key in it redacted", () => {
    const body = JSON.stringify({ error: { message: "Provider returned error", code: 400, metadata: { raw: "bad key sk-ant-abcdef1234567890\nline two", provider_name: "Anthropic" } } });
    expect(describeModelError(callError(400, body)).upstreamMessage).toBe("bad key [redacted] line two");
  });

  test("a raw upstream error given as an object, and an odd provider name dropped", () => {
    const body = JSON.stringify({ error: { message: "Provider returned error", metadata: { raw: { error: { message: "tools: invalid schema" } }, provider_name: "Evil\nName; rm" } } });
    const d = describeModelError(callError(400, body));
    expect(d.upstreamMessage).toBe("tools: invalid schema");
    expect(d.upstreamProvider).toBeNull();
  });

  test("an odd code is dropped", () => {
    expect(describeModelError(callError(400, JSON.stringify({ error: { message: "x", code: "has spaces and; stuff" } }))).providerCode).toBeNull();
  });

  test("a retry's last API call error is unwrapped", () => {
    const retried = new RetryError({ message: "Failed after 3 attempts", reason: "maxRetriesExceeded", errors: [callError(429, "{}", true), callError(429, JSON.stringify({ error: { message: "Rate limited" } }), true)] });
    const d = describeModelError(retried);
    expect(d.status).toBe(429);
    expect(d.retryable).toBe(true);
    expect(d.providerMessage).toBe("Rate limited");
  });

  test("an API call error as another error's cause is unwrapped", () => {
    const wrapped = new NoOutputGeneratedError({ message: "No output generated.", cause: callError(402, "{}") });
    expect(describeModelError(wrapped).status).toBe(402);
  });

  test("anything else gives its name only", () => {
    expect(describeModelError(new Error("provider down"))).toEqual({ name: "Error", status: null, retryable: null, providerMessage: null, providerCode: null, upstreamProvider: null, upstreamMessage: null });
    expect(describeModelError("weird")).toMatchObject({ name: "string", status: null });
  });
});

describe("cleanProviderMessage", () => {
  test("redacts key- and token-shaped text and control characters, and cuts long messages", () => {
    expect(cleanProviderMessage("bad key sk-or-v1-0123456789abcdef here")).toBe("bad key [redacted] here");
    expect(cleanProviderMessage("Authorization: Bearer abc.def")).toBe("Authorization: [redacted]");
    expect(cleanProviderMessage("token aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa end")).toBe("token [redacted] end");
    expect(cleanProviderMessage("line one\nline two‮")).toBe("line one line two");
    expect(cleanProviderMessage("   ")).toBeNull();
    const long = cleanProviderMessage("word ".repeat(200))!;
    expect(long.length).toBe(MESSAGE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("modelErrorCode and the log line", () => {
  test("the code carries the status when there is one and fits agent_runs.error", () => {
    expect(modelErrorCode({ status: 402 })).toBe("model_error:402");
    expect(modelErrorCode({ status: null })).toBe("model_error");
    expect(modelErrorCode({ status: 599 }).length).toBeLessThanOrEqual(64);
  });

  test("the log line names every field and nothing from the request", () => {
    const line = modelErrorLogLine("model stream error", describeModelError(callError(429, JSON.stringify({ error: { message: "Slow down", code: 429 } }), true)));
    expect(line).toBe('agent: model stream error name=AI_APICallError status=429 retryable=true code=429 provider="Slow down"');
    expect(line).not.toContain("private question");
    expect(line).not.toContain("openrouter.example");
    expect(line).not.toContain("session=abc");
    expect(modelErrorLogLine("model stream error", describeModelError(new Error("x")))).toBe("agent: model stream error name=Error status=none retryable=unknown");
  });
});
