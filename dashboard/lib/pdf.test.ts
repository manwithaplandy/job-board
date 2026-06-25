import { describe, expect, test, vi } from "vitest";

vi.mock("unpdf", () => ({
  extractText: vi.fn(async () => ({ text: ["Hello", "World"], totalPages: 1 })),
  getDocumentProxy: vi.fn(async () => ({})),
}));

import { extractPdfText } from "@/lib/pdf";

describe("extractPdfText", () => {
  test("joins page text", async () => {
    expect(await extractPdfText(new Uint8Array([1, 2, 3]))).toBe("Hello\nWorld");
  });

  test("empty input returns empty string without calling the parser", async () => {
    expect(await extractPdfText(new Uint8Array())).toBe("");
  });
});
