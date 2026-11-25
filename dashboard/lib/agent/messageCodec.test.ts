import { describe, expect, test } from "vitest";
import { parseStoredMessage, redactForStorage, StoredMessageSchema, type AgentUIMessage } from "@/lib/agent/messageCodec";

const row = (parts: unknown, extra: Record<string, unknown> = {}) => ({
  id: "m1",
  role: "assistant",
  parts,
  status: "complete",
  ...extra,
});

describe("parseStoredMessage", () => {
  test("parses text, reasoning, step-start and tool parts, carrying status in metadata", () => {
    const parts = [
      { type: "step-start" },
      { type: "reasoning", text: "thinking", state: "done" },
      {
        type: "tool-search_jobs",
        toolCallId: "c1",
        state: "output-available",
        input: { sort: "fit" },
        output: { rows: [], total: 0 },
      },
      {
        type: "tool-archive_job",
        toolCallId: "c2",
        state: "approval-requested",
        input: { jobId: "lever:x" },
        approval: { id: "ap1", signature: "sig" },
      },
      { type: "text", text: "Here you go", state: "done" },
    ];
    const m = parseStoredMessage(row(parts));
    expect(m).toEqual({ id: "m1", role: "assistant", parts, metadata: { status: "complete" } });
  });

  test("parseStoredMessage rejects an unknown part type", () => {
    expect(parseStoredMessage(row([{ type: "text", text: "ok" }, { type: "holographic", text: "?" }]))).toBeNull();
    expect(parseStoredMessage(row([{ type: "tool-" }]))).toBeNull();
  });

  test("rejects a bad role, status, id or parts value", () => {
    expect(parseStoredMessage(row([], { role: "system" }))).toBeNull();
    expect(parseStoredMessage(row([], { status: "done" }))).toBeNull();
    expect(parseStoredMessage(row([], { id: "" }))).toBeNull();
    expect(parseStoredMessage(row('"[{\\"type\\":\\"text\\"}]"'))).toBeNull();
    expect(parseStoredMessage(row([{ type: "text" }]))).toBeNull(); // text part without text
    expect(parseStoredMessage(row([{ type: "tool-x", toolCallId: "c", state: "teleported" }]))).toBeNull();
    expect(parseStoredMessage(null)).toBeNull();
    expect(parseStoredMessage("garbage")).toBeNull();
  });

  test("StoredMessageSchema accepts a user message with a text part", () => {
    expect(StoredMessageSchema.safeParse(row([{ type: "text", text: "hi" }], { role: "user" })).success).toBe(true);
  });
});

describe("redactForStorage", () => {
  test("redactForStorage removes a job description and document text and marks them omitted", () => {
    const m: AgentUIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_job",
          toolCallId: "c1",
          state: "output-available",
          input: { jobId: "lever:x" },
          output: { jobId: "lever:x", title: "Engineer", description: "<job_description>secret</job_description>" },
        },
        {
          type: "tool-read_document",
          toolCallId: "c2",
          state: "output-available",
          input: { id: "d1" },
          output: { id: "d1", filename: "cv.pdf", text: "my whole résumé" },
        },
        { type: "text", text: "kept" },
      ],
    };
    const out = redactForStorage(m);
    expect(out.parts[0]).toMatchObject({
      output: { jobId: "lever:x", title: "Engineer", description: null, omitted: true },
    });
    expect(out.parts[1]).toMatchObject({ output: { id: "d1", filename: "cv.pdf", text: null, omitted: true } });
    expect(out.parts[2]).toEqual({ type: "text", text: "kept" });
    expect(JSON.stringify(out)).not.toMatch(/secret|whole résumé/);
    // The input message is not mutated.
    expect(JSON.stringify(m)).toContain("secret");
  });

  test("other tools, other states and a not_available output are left alone", () => {
    const m: AgentUIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "tool-get_job", toolCallId: "c1", state: "input-available", input: { jobId: "lever:x" } },
        {
          type: "tool-get_job",
          toolCallId: "c2",
          state: "output-available",
          input: { jobId: "bad" },
          output: { status: "not_available", reason: "unknown_job" },
        },
        {
          type: "tool-get_review",
          toolCallId: "c3",
          state: "output-available",
          input: { jobId: "lever:x" },
          output: { description: "a review field", verdict: "approve" },
        },
      ],
    };
    expect(redactForStorage(m)).toEqual(m);
  });
});
