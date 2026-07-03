// Convert an uploaded résumé file into review-ready markdown that becomes the
// editable source of truth. PDF reuses the coordinate parser + serializer; if
// that yields no usable structure, fall back to flat extracted text so nothing
// is lost. New file types plug in here.
import { extractPdfItems, parsePdfItemsWithProse } from "@/lib/rolefit/parseProfile";
import { serializeProfileToMarkdown } from "@/lib/rolefit/serializeProfileToMarkdown";
import { extractPdfText } from "@/lib/pdf";

export type ResumeFileType = "pdf";

export async function fileToResumeMarkdown(bytes: Uint8Array, type: ResumeFileType): Promise<string> {
  if (bytes.length === 0) return "";
  if (type === "pdf") {
    const { profile, prose } = parsePdfItemsWithProse(await extractPdfItems(bytes));
    if (profile.name && profile.experience.length > 0) {
      return serializeProfileToMarkdown(profile, prose);
    }
    // Structured parse failed — preserve the raw text for the user to fix.
    return await extractPdfText(bytes);
  }
  return "";
}
