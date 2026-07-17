import { extractText, getDocumentProxy } from "unpdf";

// Extract plain text from PDF bytes (server-side). Returns "" for empty input.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.length === 0) return "";
  // pdf.js transfers (detaches) the buffer it's given — copy so the caller keeps ownership.
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.join("\n").trim();
}
