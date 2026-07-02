import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types";

// The résumé inputs a generation leg needs: the stored plaintext (always) plus,
// when the candidate uploaded a PDF, its raw bytes — the rich layout yields a
// better deterministic parse than text alone. The PDF download is best-effort:
// any failure logs and falls back to text-only so generation is never blocked.
// Shared by /api/resume and /api/application/prepare so the download logic lives
// in one place. Callers must have already confirmed profile.resume_text is set.
export async function getResumeSource(
  profile: Pick<ProfileRow, "resume_text" | "resume_file_path">,
): Promise<{ resumeText: string; pdfBytes?: Uint8Array }> {
  const resumeText = profile.resume_text ?? "";
  if (!profile.resume_file_path) return { resumeText };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from("resumes").download(profile.resume_file_path);
    if (error || !data) {
      console.error("résumé PDF download failed:", error?.message ?? "no data returned");
      return { resumeText };
    }
    return { resumeText, pdfBytes: new Uint8Array(await data.arrayBuffer()) };
  } catch (e) {
    console.error("résumé PDF download error:", e);
    return { resumeText };
  }
}
