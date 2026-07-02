// RUNTIME-PURE: imports only the TailoredResume type, so this is safe to import
// from the client bundle, server routes, and the CLI harness alike.
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

/** Plain-text résumé from a TailoredResume (used for copy, PDF fallback, and the
 *  LangFuse trace output the managed judge reads). */
export function composeResumeText(data: TailoredResume): string {
  let t = `${data.name}\n${data.headline}\n`;
  if (data.contact) t += `${data.contact}\n`;
  t += `\nSUMMARY\n${data.summary}\n\nCORE SKILLS\n${data.skills.join(", ")}\n\nEXPERIENCE\n`;
  data.experience.forEach((exp) => {
    t += `${exp.role}, ${exp.company} (${exp.dates})\n`;
    exp.bullets.forEach((b) => { t += `  - ${b}\n`; });
    t += "\n";
  });
  t += "EDUCATION\n";
  data.education.forEach((entry) => { t += `${entry}\n`; });
  if (data.certifications.length) t += `Certifications: ${data.certifications.join(" · ")}\n`;
  return t;
}
