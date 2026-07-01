// dashboard/lib/rolefit/openrouterClient.test.ts
import { describe, expect, test, vi } from "vitest";
import { callOpenRouterStructured, OPENROUTER_CHAT_URL } from "@/lib/rolefit/openrouterClient";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

const baseArgs = {
  generationName: "test-generation",
  label: "thing",
  model: "test/model",
  apiKey: "sk-test",
  system: "sys",
  user: "Cobalt user prompt",
  responseFormat: { type: "json_schema", json_schema: { name: "x" } },
  maxTokens: 1234,
  retryDelayMs: 0, // avoid real delays in tests
};

describe("callOpenRouterStructured", () => {
  test("posts model + messages + response_format + auth header, returns parsed result", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) } }] });
    const out = await callOpenRouterStructured<{ ok: number }>({
      ...baseArgs,
      fetchImpl: f,
      parse: (raw) => raw as { ok: number },
    });
    expect(out).toEqual({ ok: 1 });
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe(OPENROUTER_CHAT_URL);
    const init = call[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("test/model");
    expect(body.max_tokens).toBe(1234);
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body.messages)).toContain("Cobalt");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test", "X-Title": "job-board" });
  });

  test("throws a labelled error on non-ok response", async () => {
    await expect(
      callOpenRouterStructured({ ...baseArgs, fetchImpl: fakeFetch({}, false), parse: (r) => r }),
    ).rejects.toThrow("OpenRouter thing request failed: 502");
  });

  test("throws when the model returns no content", async () => {
    const f = fakeFetch({ choices: [{ message: {} }] });
    await expect(
      callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r }),
    ).rejects.toThrow("OpenRouter returned no content");
  });

  test("throws a labelled error when content is not JSON", async () => {
    const f = fakeFetch({ choices: [{ message: { content: "not json" } }] });
    await expect(
      callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r }),
    ).rejects.toThrow("OpenRouter returned non-JSON thing content");
  });

  test("propagates the error thrown by the caller's parse step", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ bad: true }) } }] });
    await expect(
      callOpenRouterStructured({
        ...baseArgs,
        fetchImpl: f,
        parse: () => { throw new Error("missing required fields"); },
      }),
    ).rejects.toThrow("missing required fields");
  });
});

describe("transport hardening", () => {
  test("sends usage accounting opt-in", async () => {
    const f = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) }, finish_reason: "stop" }], usage: { cost: 0.001 } }),
    })) as unknown as typeof fetch;
    await callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r as { ok: number } });
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const body = JSON.parse(calls[0][1].body as string) as { usage: unknown };
    expect(body.usage).toEqual({ include: true });
  });

  test("includes response body in thrown error on 429", async () => {
    const f = vi.fn(async () => ({
      ok: false, status: 429,
      text: async () => "rate limited",
    })) as unknown as typeof fetch;
    await expect(
      callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r }),
    ).rejects.toThrow(/rate limited/);
  });

  test("retries once on 429 then succeeds", async () => {
    let call = 0;
    const f = vi.fn(async () => {
      call++;
      if (call === 1) return { ok: false, status: 429, text: async () => "rate limited" };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) }, finish_reason: "stop" }] }) };
    }) as unknown as typeof fetch;
    const result = await callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r as { ok: number } });
    expect(result).toEqual({ ok: 1 });
    expect((f as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(2);
  });

  test("labels max_tokens truncation distinctly", async () => {
    const f = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) }, finish_reason: "length" }] }),
    })) as unknown as typeof fetch;
    await expect(
      callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r }),
    ).rejects.toThrow(/truncated/);
  });

  test("aborts after timeout (AbortSignal.timeout wired)", async () => {
    const f = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ ok: 1 }) }, finish_reason: "stop" }] }),
    })) as unknown as typeof fetch;
    await callOpenRouterStructured({ ...baseArgs, fetchImpl: f, parse: (r) => r as { ok: number } });
    const calls = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls[0][1].signal).toBeDefined();
  });
});
