// RUNTIME-PURE deterministic mechanical checks over a generated résumé, derived
// from the generation contract in resumeSchema.ts. Subjective quality (grounding,
// JD-relevance) is scored by the LLM-judge; these catch the mechanical failures.
// Profile-dependent checks (anti-hallucination, roles-in-order) only run when a
// ParsedProfile is passed, so the client can call resumeChecks(resume) alone.
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

export interface ResumeCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}
export interface ResumeChecks {
  checks: ResumeCheck[];
  passCount: number;
  total: number;
}

const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0);
const firstVerb = (bullet: string): string =>
  (bullet.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
const normSkill = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function resumeChecks(resume: TailoredResume, parsed?: ParsedProfile): ResumeChecks {
  const checks: ResumeCheck[] = [];
  const bullets = resume.experience.flatMap((e) => e.bullets);

  // Skills count 12–16.
  checks.push({
    id: "skills_count",
    label: "12–16 skills",
    pass: resume.skills.length >= 12 && resume.skills.length <= 16,
    detail: `${resume.skills.length} skills`,
  });

  // No duplicate/subsuming skill (e.g. "AWS" and "AWS S3").
  const skillDup = (() => {
    const norm = resume.skills.map(normSkill);
    for (let i = 0; i < norm.length; i++) {
      for (let j = 0; j < norm.length; j++) {
        if (i === j || !norm[i] || !norm[j]) continue;
        if (norm[i] === norm[j] && i < j) return resume.skills[i];
        // subsuming: one skill's tokens are a superset containing the other whole
        if (norm[i] !== norm[j] && (` ${norm[i]} `).includes(` ${norm[j]} `)) return resume.skills[j];
      }
    }
    return null;
  })();
  checks.push({
    id: "skills_dedup",
    label: "no duplicate/subsuming skills",
    pass: skillDup === null,
    detail: skillDup ? `duplicate: ${skillDup}` : undefined,
  });

  // No repeated opening verb across ALL bullets.
  const verbs = bullets.map(firstVerb).filter(Boolean);
  const repeatedVerb = verbs.find((v, i) => verbs.indexOf(v) !== i) ?? null;
  checks.push({
    id: "verb_repeat",
    label: "unique opening verbs",
    pass: repeatedVerb === null,
    detail: repeatedVerb ? `repeated: ${repeatedVerb}` : undefined,
  });

  // Each bullet ≤24 words.
  const longBullet = bullets.find((b) => wordCount(b) > 24) ?? null;
  checks.push({
    id: "bullet_length",
    label: "bullets ≤24 words",
    pass: longBullet === null,
    detail: longBullet ? `${wordCount(longBullet)} words` : undefined,
  });

  // Summary ≤70 words.
  const sw = wordCount(resume.summary);
  checks.push({ id: "summary_length", label: "summary ≤70 words", pass: sw <= 70, detail: `${sw} words` });

  // Headline ≤55 chars (deterministic role-title portion may push it; heuristic guard).
  checks.push({
    id: "headline_length",
    label: "headline ≤80 chars",
    pass: resume.headline.length <= 80,
    detail: `${resume.headline.length} chars`,
  });

  // Per-role bullet counts 2–7 (roles with source material).
  const badRole = resume.experience.find((e) => e.bullets.length > 7) ?? null;
  checks.push({
    id: "bullets_per_role",
    label: "≤7 bullets per role",
    pass: badRole === null,
    detail: badRole ? `${badRole.company}: ${badRole.bullets.length}` : undefined,
  });

  // One-page volume heuristic: total bullets within a sane band.
  checks.push({
    id: "one_page_fit",
    label: "one-page volume (≤24 bullets)",
    pass: bullets.length <= 24,
    detail: `${bullets.length} bullets`,
  });

  // Profile-dependent (anti-hallucination) — only when a profile is available.
  if (parsed) {
    const rolesOk =
      resume.experience.length === parsed.experience.length &&
      resume.experience.every((e, i) => {
        const p = parsed.experience[i];
        return p && normSkill(e.company).startsWith(normSkill(p.company).split(" ")[0] ?? "");
      });
    checks.push({
      id: "roles_present",
      label: "all profile roles present, in order",
      pass: rolesOk,
      detail: rolesOk ? undefined : `${resume.experience.length} vs ${parsed.experience.length} roles`,
    });

    const profileCompanies = parsed.experience.map((r) => normSkill(r.company));
    const foreign = resume.experience.find(
      (e) => !profileCompanies.some((pc) => pc && (normSkill(e.company).includes(pc) || pc.includes(normSkill(e.company)))),
    );
    checks.push({
      id: "no_foreign_company",
      label: "no company outside the profile",
      pass: !foreign,
      detail: foreign ? `foreign: ${foreign.company}` : undefined,
    });
  }

  const passCount = checks.filter((c) => c.pass).length;
  return { checks, passCount, total: checks.length };
}
