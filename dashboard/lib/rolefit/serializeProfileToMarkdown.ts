// RUNTIME-PURE: imports only types + parseProfile types. Emits the markdown
// dialect parseProfileText parses, so an uploaded file round-trips to the same
// ParsedProfile the generator would build, while prose (Summary/Skills) survives
// as LLM context.
import type { ParsedProfile, ProseSection } from "@/lib/rolefit/parseProfile";

export function serializeProfileToMarkdown(profile: ParsedProfile, prose: ProseSection[] = []): string {
  const out: string[] = [];
  if (profile.name) out.push(`# ${profile.name}`, "");
  if (profile.contact) out.push(profile.contact, "");

  for (const section of prose) {
    if (!section.heading || !section.lines.length) continue;
    out.push(`## ${section.heading}`, "");
    for (const l of section.lines) out.push(l);
    out.push("");
  }

  if (profile.experience.length) {
    out.push("## Experience", "");
    for (const r of profile.experience) {
      if (r.company) out.push(`### ${r.company}`, "");
      const roleLine = [r.role, r.dates].filter(Boolean).join(" · ");
      if (roleLine) out.push(`#### ${roleLine}`, "");
      for (const b of r.sourceBullets) out.push(`- ${b}`);
      out.push("");
    }
  }

  if (profile.educationEntries.length) {
    out.push("## Education", "");
    for (const e of profile.educationEntries) out.push(`- ${e}`);
    out.push("");
  }

  if (profile.certifications.length) {
    out.push("## Certifications", "");
    for (const c of profile.certifications) out.push(`- ${c}`);
    out.push("");
  }

  return out.join("\n").trim() + "\n";
}
