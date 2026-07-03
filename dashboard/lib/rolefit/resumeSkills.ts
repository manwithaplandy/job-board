// RUNTIME-PURE deterministic grounding filter for the LLM's tailored skills.
//
// The résumé generator lets the model surface the skills list, but skills are
// FACTS, not prose — and on a strong-mismatch job a cheap model still pulls a
// few JD-adjacent skills the candidate lacks (e.g. "GraphQL" when the background
// shows only REST, "Docker" when it shows only Kubernetes). The prompt fights
// this but can't fully win, so this is the deterministic backstop: drop any
// skill with ZERO evidence in the candidate's real background.
//
// Conservative BY DESIGN — a skill is removed only when NONE of its significant
// tokens appears in the source, so rephrasings of real skills survive
// ("Node" → "Node.js", "RAG" → "RAG architectures", "CI/CD" → "GitHub Actions
// CI/CD"). The evidence corpus is the candidate's material only (background text
// + their real bullets/certs/education), never the model's own output or the job
// posting — grounding against either would be circular or self-defeating.
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

// Generic words that carry no grounding signal — a skill needs a DISTINCTIVE
// token to count as evidenced, so "Data pipelines" isn't rescued by a stray
// "data" in the source. Kept deliberately small: only true filler.
const SKILL_STOPWORDS = new Set([
  "and", "or", "of", "the", "with", "in", "for", "to", "a", "an",
  "systems", "system", "tools", "tool", "platform", "platforms",
  "architecture", "architectures", "pattern", "patterns", "framework",
  "frameworks", "development", "engineering", "management", "based", "using",
  "various", "stack", "technologies", "technology", "solutions", "services",
  "service", "apis", "api", "databases", "database", "programming", "design",
  "modern", "advanced", "core", "best", "practices", "workflows", "workflow",
]);

// Broad category labels that name a provider/umbrella, not a specific skill.
// When a skill also carries a more-specific token, the umbrella alone does not
// ground it — so "AWS Lambda" must ground "lambda", while "AWS (Bedrock,
// OpenSearch)" grounds on its real services and bare "AWS" grounds on "aws".
const SKILL_UMBRELLAS = new Set([
  "aws", "azure", "gcp", "google", "microsoft", "amazon", "cloud", "apache",
]);

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function significantTokens(skill: string): string[] {
  return norm(skill)
    .split(" ")
    .filter((t) => t.length >= 2 && !SKILL_STOPWORDS.has(t));
}

/** Token set of the candidate's real material — the grounding evidence corpus. */
export function groundingCorpus(profile: ParsedProfile, backgroundText: string): Set<string> {
  const parts = [
    backgroundText,
    ...profile.certifications,
    ...profile.educationEntries,
    ...profile.experience.flatMap((r) => [r.role, r.company, ...r.sourceBullets]),
  ];
  const set = new Set<string>();
  for (const p of parts) for (const t of norm(p).split(" ")) if (t) set.add(t);
  return set;
}

/** A token is evidenced by an exact corpus token or a suffix variant (llm↔llms, git↔github). */
function evidenced(token: string, corpus: Set<string>): boolean {
  if (corpus.has(token)) return true;
  if (token.length >= 3) {
    for (const c of corpus) {
      if (c.length >= 3 && (c.startsWith(token) || token.startsWith(c))) return true;
    }
  }
  return false;
}

/**
 * Keep only skills with at least one significant token evidenced in the corpus.
 * A skill whose significant tokens are ALL absent from the candidate's material
 * is a fabrication and is dropped. An empty corpus (no background to check
 * against) or a skill with no significant tokens is left untouched.
 */
export function groundSkills(skills: string[], corpus: Set<string>): string[] {
  if (corpus.size === 0) return skills;
  return skills.filter((skill) => {
    const toks = significantTokens(skill);
    if (toks.length === 0) return true;
    // Judge on the specific tokens; fall back to the umbrella only when the
    // skill is nothing but an umbrella (bare "AWS", "Azure").
    const specific = toks.filter((t) => !SKILL_UMBRELLAS.has(t));
    const judged = specific.length ? specific : toks;
    return judged.some((t) => evidenced(t, corpus));
  });
}
