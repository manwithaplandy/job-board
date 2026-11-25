// The three synthetic job seekers of the golden scenarios (plan Task 1.22). Everything
// here is invented and meant to look invented: example.test addresses, fictional towns
// (Exampleton, Testville, Sampleford, Mockport), companies with Example, Sample,
// Placeholder, Mock, Fictional or Imaginary in their names, and posting links under
// jobs.example.test. No real person, company or posting.
//
// Each persona has a markdown résumé, preferred locations, 30 catalog jobs with a
// review each, a memo, and the tailored résumé the phase 1 gate's prep stand-in writes
// (it passes resumeChecks against the résumé). seedPersona writes a persona into a
// harness database through the owner connection; it never runs against production
// (the callers open the database through lib/testing/dbHarness, which refuses any other).
import type postgres from "postgres";
import { profileVersion } from "@/lib/profileVersion";
import { USER_DELETE_TABLES } from "@/lib/userScopedTables";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { MemoDoc } from "@/lib/workspaces/types";
import type { PersonaSetup } from "@/lib/agent/evals/scenarios";

export const PERSONA_IDS = ["senior-backend", "career-switcher", "new-grad"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export interface PersonaJob {
  jobId: string;
  companyToken: string;
  companyName: string;
  title: string;
  url: string;
  location: string;
  remote: boolean;
  ageDays: number;
  fitScore: number;
  payMin: number | null;
  payMax: number | null;
  requirements: Array<{ text: string; met: boolean }>;
}

export interface Persona {
  id: PersonaId;
  userId: string;
  /** The uploaded résumé's document id (scenario a). */
  documentId: string;
  name: string;
  email: string;
  resumeText: string;
  preferredLocations: string[];
  memo: MemoDoc;
  jobs: PersonaJob[];
  /** What the prep stand-in stores as the tailored résumé. */
  tailoredResume: TailoredResume;
}

interface PersonaSource {
  id: PersonaId;
  userId: string;
  documentId: string;
  slug: string;
  name: string;
  email: string;
  resumeText: string;
  preferredLocations: [string, string];
  memo: MemoDoc;
  companies: string[];
  titles: string[];
  requirements: string[];
  payBase: number;
  tailoredResume: TailoredResume;
}

const JOBS_PER_PERSONA = 30;

/** 30 jobs: every company gets one of each title in turn, fit falling from 94 by 2. */
function buildJobs(p: PersonaSource): PersonaJob[] {
  return Array.from({ length: JOBS_PER_PERSONA }, (_, i) => {
    const companyName = p.companies[i % p.companies.length];
    const companyToken = `eval-${p.slug}-${i % p.companies.length}`;
    const n = 1000 + i;
    const where = i % 3;
    const location = where === 1 ? "Remote" : p.preferredLocations[where === 0 ? 0 : 1];
    const paid = i % 4 !== 3;
    return {
      jobId: `greenhouse:${companyToken}:${n}`,
      companyToken,
      companyName,
      title: p.titles[i % p.titles.length],
      url: `https://jobs.example.test/${companyToken}/${n}`,
      location,
      remote: location === "Remote",
      ageDays: i % 20,
      fitScore: 94 - 2 * i,
      payMin: paid ? p.payBase + 1000 * (i % 7) : null,
      payMax: paid ? p.payBase + 25_000 + 1000 * (i % 7) : null,
      requirements: p.requirements.map((text, k) => ({ text, met: (i + k) % 3 !== 0 })),
    };
  });
}

const SOURCES: PersonaSource[] = [
  {
    id: "senior-backend",
    userId: "e7a10000-0000-4000-8000-000000000001",
    documentId: "e7a1d0c0-0000-4000-8000-000000000001",
    slug: "sb",
    name: "Avery Example",
    email: "avery@example.test",
    preferredLocations: ["Exampleton", "Testville"],
    resumeText: [
      "# Avery Example",
      "avery@example.test · Exampleton",
      "",
      "## Summary",
      "Backend engineer with nine years of building payment and data services.",
      "",
      "## Experience",
      "### Lumen Example Systems — Exampleton",
      "#### Senior Backend Engineer · Mar 2021 – Present",
      "- Led the move of the billing ledger to an event-sourced service handling forty thousand writes a second.",
      "- Cut p99 API latency from 900 ms to 180 ms by reworking the query layer.",
      "- Mentored five engineers and ran the on-call rotation for the payments group.",
      "### Quarry Sample Labs — Testville",
      "#### Backend Engineer · Jun 2017 – Feb 2021",
      "- Built the ingestion pipeline for sensor data in Go and Kafka.",
      "- Designed the internal gRPC API used by twelve services.",
      "### Harbor Placeholder Works — Testville",
      "#### Software Engineer · Jul 2015 – May 2017",
      "- Maintained the order service and its PostgreSQL schema.",
      "- Automated deploys with Terraform and a CI pipeline.",
      "",
      "## Education",
      "- B.Sc. Computer Science — Example State University",
      "",
      "## Skills",
      "Go, PostgreSQL, Kafka, Kubernetes, Terraform, gRPC, Redis, Python",
    ].join("\n"),
    memo: {
      role: "Senior or staff backend engineer on a platform or payments team.",
      locations: "Remote, Exampleton or Testville.",
      compensation: "At least 160,000 USD a year.",
      mustHaves: "Go or another typed backend language; a team that owns its on-call.",
      dealBreakers: "Gambling and crypto companies.",
      companies: "",
      other: "",
    },
    companies: [
      "Zephyr Example Cloud",
      "Placeholder Payments",
      "Sample Freight Systems",
      "Mock Health Platform",
      "Fictional Data Works",
      "Imaginary Retail Tech",
    ],
    titles: [
      "Senior Backend Engineer",
      "Staff Software Engineer, Platform",
      "Senior Go Engineer",
      "Backend Engineer, Payments",
      "Senior Data Infrastructure Engineer",
    ],
    requirements: ["Five or more years building backend services", "Production Go or Java", "Owning on-call for a service"],
    payBase: 150_000,
    tailoredResume: {
      name: "Avery Example",
      contact: "avery@example.test · Exampleton",
      headline: "Senior Backend Engineer · payments and event-driven platforms",
      summary:
        "Backend engineer with nine years of building payment and data services, from event-sourced ledgers to low-latency APIs.",
      skills: [
        "Go",
        "PostgreSQL",
        "Kafka",
        "Kubernetes",
        "Terraform",
        "gRPC",
        "Redis",
        "Python",
        "Event sourcing",
        "Observability",
        "API design",
        "Incident response",
        "Linux",
        "Load testing",
      ],
      experience: [
        {
          role: "Senior Backend Engineer",
          company: "Lumen Example Systems",
          dates: "Mar 2021 – Present",
          bullets: [
            "Led the move of the billing ledger to an event-sourced service handling forty thousand writes a second.",
            "Cut p99 API latency from 900 ms to 180 ms by reworking the query layer.",
            "Mentored five engineers and ran the payments on-call rotation.",
          ],
        },
        {
          role: "Backend Engineer",
          company: "Quarry Sample Labs",
          dates: "Jun 2017 – Feb 2021",
          bullets: [
            "Built the sensor ingestion pipeline in Go and Kafka.",
            "Designed the internal gRPC API used by twelve services.",
          ],
        },
        {
          role: "Software Engineer",
          company: "Harbor Placeholder Works",
          dates: "Jul 2015 – May 2017",
          bullets: ["Maintained the order service and its PostgreSQL schema.", "Automated deploys with Terraform and CI."],
        },
      ],
      education: ["B.Sc. Computer Science — Example State University"],
      certifications: [],
    },
  },
  {
    id: "career-switcher",
    userId: "e7a10000-0000-4000-8000-000000000002",
    documentId: "e7a1d0c0-0000-4000-8000-000000000002",
    slug: "cs",
    name: "Jordan Placeholder",
    email: "jordan@example.test",
    preferredLocations: ["Sampleford", "Mockport"],
    resumeText: [
      "# Jordan Placeholder",
      "jordan@example.test · Sampleford",
      "",
      "## Summary",
      "Former science teacher moving into data analysis, with a year of hands-on analytics work.",
      "",
      "## Experience",
      "### Brightside Example Nonprofit — Sampleford",
      "#### Data Analyst Intern · Sep 2025 – Present",
      "- Built a donor retention dashboard in SQL and a BI tool used by the board.",
      "- Cleaned five years of volunteer records and documented the data model.",
      "### Example Valley School — Mockport",
      "#### Science Teacher · Aug 2017 – Aug 2025",
      "- Tracked results for 150 students a year and reported trends to the department.",
      "- Designed a lab curriculum adopted by three other schools.",
      "",
      "## Education",
      "- B.Sc. Biology — Sampleford College",
      "",
      "## Certifications",
      "- Data Analytics Certificate",
      "",
      "## Skills",
      "SQL, Python, spreadsheets, dashboards, statistics",
    ].join("\n"),
    memo: {
      role: "Junior or mid-level data analyst; open to analytics associate roles.",
      locations: "Remote, Sampleford or Mockport.",
      compensation: "At least 65,000 USD a year.",
      mustHaves: "A team with an experienced analyst to learn from.",
      dealBreakers: "Unpaid trial work.",
      companies: "Education or public-interest work is a plus.",
      other: "",
    },
    companies: [
      "Sample Learning Co",
      "Example Civic Data",
      "Placeholder Analytics",
      "Mock Insurance Group",
      "Fictional Foods Ltd",
      "Imaginary Transit Lab",
    ],
    titles: ["Junior Data Analyst", "Data Analyst", "Analytics Associate", "Business Intelligence Analyst", "Reporting Analyst"],
    requirements: ["SQL for reporting", "Dashboards in a BI tool", "Explaining findings to non-technical people"],
    payBase: 60_000,
    tailoredResume: {
      name: "Jordan Placeholder",
      contact: "jordan@example.test · Sampleford",
      headline: "Data Analyst · reporting, dashboards and clear explanations",
      summary:
        "Former science teacher moving into data analysis, with a year of hands-on analytics work and eight years of explaining numbers to people.",
      skills: [
        "SQL",
        "Python",
        "Spreadsheets",
        "Dashboards",
        "Statistics",
        "Data cleaning",
        "Data modeling",
        "Reporting",
        "Visualization",
        "Stakeholder communication",
        "Documentation",
        "Survey analysis",
      ],
      experience: [
        {
          role: "Data Analyst Intern",
          company: "Brightside Example Nonprofit",
          dates: "Sep 2025 – Present",
          bullets: [
            "Built a donor retention dashboard in SQL used by the board.",
            "Cleaned five years of volunteer records and documented the data model.",
          ],
        },
        {
          role: "Science Teacher",
          company: "Example Valley School",
          dates: "Aug 2017 – Aug 2025",
          bullets: [
            "Tracked results for 150 students a year and reported trends to the department.",
            "Designed a lab curriculum adopted by three other schools.",
          ],
        },
      ],
      education: ["B.Sc. Biology — Sampleford College"],
      certifications: ["Data Analytics Certificate"],
    },
  },
  {
    id: "new-grad",
    userId: "e7a10000-0000-4000-8000-000000000003",
    documentId: "e7a1d0c0-0000-4000-8000-000000000003",
    slug: "ng",
    name: "Sam Sample",
    email: "sam@example.test",
    preferredLocations: ["Testville", "Mockport"],
    resumeText: [
      "# Sam Sample",
      "sam@example.test · Testville",
      "",
      "## Summary",
      "New computer science graduate who likes web products and testing.",
      "",
      "## Experience",
      "### Testbed Example Corp — Testville",
      "#### Software Engineering Intern · Jun 2025 – Aug 2025",
      "- Shipped a settings page in TypeScript and React used by every customer.",
      "- Added end-to-end tests that caught two release blockers.",
      "### Campus Sample Lab — Testville",
      "#### Research Assistant · Sep 2023 – May 2025",
      "- Wrote Python scripts that cut experiment setup from a day to an hour.",
      "- Presented results at the student research fair.",
      "",
      "## Education",
      "- B.Sc. Computer Science — Testville Example University",
      "",
      "## Skills",
      "TypeScript, React, Python, SQL, Git, testing",
    ].join("\n"),
    memo: {
      role: "Entry-level software engineer, ideally frontend or full stack.",
      locations: "Remote, Testville or Mockport.",
      compensation: "At least 80,000 USD a year.",
      mustHaves: "Mentorship and code review.",
      dealBreakers: "",
      companies: "",
      other: "Graduated this year.",
    },
    companies: [
      "Example Apps Studio",
      "Sample Maps Co",
      "Placeholder Learning",
      "Mock Media House",
      "Fictional Games Lab",
      "Imaginary Bank Tech",
    ],
    titles: [
      "Software Engineer I",
      "Junior Frontend Engineer",
      "Graduate Software Engineer",
      "Associate Software Engineer",
      "Junior Full-Stack Developer",
    ],
    requirements: ["A computer science degree or equivalent", "JavaScript or TypeScript", "Writing tests"],
    payBase: 75_000,
    tailoredResume: {
      name: "Sam Sample",
      contact: "sam@example.test · Testville",
      headline: "Software Engineer · web products and testing",
      summary: "New computer science graduate who builds web products in TypeScript and React and cares about tests.",
      skills: [
        "TypeScript",
        "React",
        "Python",
        "SQL",
        "Git",
        "End-to-end testing",
        "Unit testing",
        "HTML",
        "CSS",
        "REST APIs",
        "Accessibility",
        "Node.js",
      ],
      experience: [
        {
          role: "Software Engineering Intern",
          company: "Testbed Example Corp",
          dates: "Jun 2025 – Aug 2025",
          bullets: [
            "Shipped a settings page in TypeScript and React used by every customer.",
            "Added end-to-end tests that caught two release blockers.",
          ],
        },
        {
          role: "Research Assistant",
          company: "Campus Sample Lab",
          dates: "Sep 2023 – May 2025",
          bullets: [
            "Wrote Python scripts that cut experiment setup from a day to an hour.",
            "Presented results at the student research fair.",
          ],
        },
      ],
      education: ["B.Sc. Computer Science — Testville Example University"],
      certifications: [],
    },
  },
];

function toPersona(p: PersonaSource): Persona {
  return {
    id: p.id,
    userId: p.userId,
    documentId: p.documentId,
    name: p.name,
    email: p.email,
    resumeText: p.resumeText,
    preferredLocations: [...p.preferredLocations],
    memo: p.memo,
    jobs: buildJobs(p),
    tailoredResume: p.tailoredResume,
  };
}

export const PERSONAS: Record<PersonaId, Persona> = {
  "senior-backend": toPersona(SOURCES[0]),
  "career-switcher": toPersona(SOURCES[1]),
  "new-grad": toPersona(SOURCES[2]),
};

/** The persona whose user id this is, or null. */
export function personaByUserId(userId: string): Persona | null {
  return Object.values(PERSONAS).find((p) => p.userId === userId) ?? null;
}

/** The profile version the seeded reviews were made against: the résumé as setResumeFromDocument stores it (trimmed). */
export function reviewedProfileVersion(persona: Persona): string {
  return profileVersion(persona.resumeText.trim(), null);
}

export const DEFAULT_SETUP: PersonaSetup = { resume: "on_profile", memo: true, applications: false };

/** The uploaded résumé's storage path (documents_storage_path_owned: the user's own doc-<id>-<name>). */
function documentPath(persona: Persona): string {
  return `${persona.userId}/doc-${persona.documentId}-resume.md`;
}

/** Deletes every row the persona's user owns (the account-deletion list). The catalog jobs stay. */
export async function clearPersona(sql: postgres.Sql, persona: Persona): Promise<void> {
  for (const table of USER_DELETE_TABLES) {
    await sql.unsafe(`DELETE FROM ${table} WHERE user_id = $1::uuid`, [persona.userId]);
  }
}

/**
 * The application-prep stand-in (owner connection): what a finished prep leaves behind,
 * a prepared package with the persona's tailored résumé. The real prep fetches the
 * posting's questions and generates documents with a model, which neither the gate nor
 * the eval may do; both replace start_application_prep's work with this.
 */
export async function writeStandInPackage(sql: postgres.Sql, persona: Persona, jobId: string): Promise<void> {
  await sql`
    INSERT INTO application_packages (user_id, job_id, resume_json, profile_version, status)
    VALUES (${persona.userId}, ${jobId}, ${JSON.stringify(persona.tailoredResume)}::text::jsonb,
            ${reviewedProfileVersion(persona)}, 'prepared')
    ON CONFLICT (user_id, job_id) DO UPDATE SET resume_json = EXCLUDED.resume_json, prepared_at = now()`;
}

/** Days ago each seeded application was applied; the first two later got interviews. */
const APPLIED_DAYS_AGO = [2, 4, 6, 9, 13, 16];
const FIRST_APPLICATION_JOB = 10;

/**
 * Writes the persona into a harness database (owner connection): its catalog
 * companies and jobs (upserted, open), a review of each job at the résumé's profile
 * version, the profile, and what the setup asks for. Clears the user's rows first, so
 * it can run again. Returns the user id.
 */
export async function seedPersona(sql: postgres.Sql, persona: Persona, setup: PersonaSetup = DEFAULT_SETUP): Promise<string> {
  await clearPersona(sql, persona);
  const reviewed = reviewedProfileVersion(persona);
  const companyIds = new Map<string, number>();
  for (const job of persona.jobs) {
    if (!companyIds.has(job.companyToken)) {
      const [row] = await sql`
        INSERT INTO companies (name, ats, token) VALUES (${job.companyName}, 'greenhouse', ${job.companyToken})
        ON CONFLICT (ats, token) DO UPDATE SET name = EXCLUDED.name, active = true
        RETURNING id`;
      companyIds.set(job.companyToken, Number(row?.id));
    }
    await sql`
      INSERT INTO jobs (id, company_id, external_id, title, url, location, remote, first_seen_at, last_seen_at, closed_at)
      VALUES (${job.jobId}, ${companyIds.get(job.companyToken) ?? null}, ${job.jobId.split(":")[2] ?? job.jobId},
              ${job.title}, ${job.url}, ${job.location}, ${job.remote},
              now() - make_interval(days => ${job.ageDays}), now(), NULL)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, title = EXCLUDED.title, url = EXCLUDED.url,
        location = EXCLUDED.location, remote = EXCLUDED.remote, first_seen_at = EXCLUDED.first_seen_at,
        last_seen_at = now(), closed_at = NULL`;
    await sql`
      INSERT INTO job_reviews (user_id, job_id, profile_version, stage1_decision, verdict, fit_score, skills_score,
                               experience_score, pay_min, pay_max, pay_currency, pay_period, work_arrangement,
                               seniority, requirements, reasoning)
      VALUES (${persona.userId}, ${job.jobId}, ${reviewed}, 'pass', ${job.fitScore >= 60 ? "approve" : "deny"},
              ${job.fitScore}, ${Math.min(100, job.fitScore + 3)}, ${Math.max(0, job.fitScore - 4)},
              ${job.payMin}, ${job.payMax}, ${job.payMin === null ? null : "USD"}, ${job.payMin === null ? null : "year"},
              ${job.remote ? "remote" : "hybrid"}, 'mid',
              ${JSON.stringify(job.requirements)}::text::jsonb, 'Synthetic review for the golden scenarios.')`;
  }

  const onProfile = setup.resume === "on_profile";
  await sql`
    INSERT INTO profiles (user_id, resume_text, profile_version, preferred_locations)
    VALUES (${persona.userId}, ${onProfile ? persona.resumeText.trim() : null},
            ${onProfile ? reviewed : profileVersion(null, null)}, ${persona.preferredLocations})`;

  if (setup.resume === "uploaded") {
    await sql`
      INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extracted_text, extraction)
      VALUES (${persona.documentId}, ${persona.userId}, 'resume', 'resume.md', 'text/markdown',
              ${Buffer.byteLength(persona.resumeText, "utf8")}, ${documentPath(persona)}, ${persona.resumeText}, 'ok')`;
  }

  if (setup.memo) {
    const doc = JSON.stringify(persona.memo);
    await sql`INSERT INTO search_memos (user_id, version, doc) VALUES (${persona.userId}, 1, ${doc}::text::jsonb)`;
    await sql`INSERT INTO search_memo_versions (user_id, version, doc, changed_by)
              VALUES (${persona.userId}, 1, ${doc}::text::jsonb, 'user')`;
  }

  if (setup.applications) {
    for (const [k, days] of APPLIED_DAYS_AGO.entries()) {
      const job = persona.jobs[FIRST_APPLICATION_JOB + k];
      const interviewed = k < 2;
      const [app] = await sql`
        INSERT INTO applications (user_id, job_id, stage, created_at, updated_at)
        VALUES (${persona.userId}, ${job.jobId}, ${interviewed ? "interviewing" : "applied"},
                now() - make_interval(days => ${days + 1}),
                now() - make_interval(days => ${interviewed ? days - 1 : days}))
        RETURNING id`;
      await sql`
        INSERT INTO application_events (user_id, application_id, kind, to_stage, actor, created_at)
        VALUES (${persona.userId}, ${String(app?.id)}, 'stage', 'applied', 'user', now() - make_interval(days => ${days}))`;
      if (interviewed) {
        await sql`
          INSERT INTO application_events (user_id, application_id, kind, from_stage, to_stage, actor, created_at)
          VALUES (${persona.userId}, ${String(app?.id)}, 'stage', 'applied', 'interviewing', 'user',
                  now() - make_interval(days => ${days - 1}))`;
      }
    }
  }
  return persona.userId;
}
