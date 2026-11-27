// What the agent did, is doing, or could not do, in plain words (PR K1; the steps row of
// docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md section 7). A raw tool name
// ("Looked up get profile summary") means nothing to a user.

type ToolLabels = {
  /** Past tense, for a finished step: "Searched your reviewed jobs". */
  done: string;
  /** Present tense, for the working steps row: "Searching your reviewed jobs". */
  doing: string;
  /** For a step that ended in an error: "Could not search your reviewed jobs". */
  failed: string;
};

const LABELS: Record<string, ToolLabels> = {
  add_application_note: {
    done: "Added a note to an application",
    doing: "Adding a note to an application",
    failed: "Could not add a note to an application",
  },
  ask_user: { done: "Asked you a question", doing: "Asking you a question", failed: "Could not ask you a question" },
  get_job: { done: "Read a job posting", doing: "Reading a job posting", failed: "Could not read a job posting" },
  get_memo: {
    done: "Read what you're looking for",
    doing: "Reading what you're looking for",
    failed: "Could not read what you're looking for",
  },
  get_profile_summary: { done: "Read your profile", doing: "Reading your profile", failed: "Could not read your profile" },
  get_review: { done: "Read a job review", doing: "Reading a job review", failed: "Could not read a job review" },
  list_applications: {
    done: "Checked your applications",
    doing: "Checking your applications",
    failed: "Could not check your applications",
  },
  list_documents: {
    done: "Checked your documents",
    doing: "Checking your documents",
    failed: "Could not check your documents",
  },
  list_shortlist: {
    done: "Checked your shortlist",
    doing: "Checking your shortlist",
    failed: "Could not check your shortlist",
  },
  present: { done: "Built a view", doing: "Building a view", failed: "Could not build a view" },
  propose_memo_change: {
    done: "Suggested a change to what you're looking for",
    doing: "Suggesting a change to what you're looking for",
    failed: "Could not suggest a change to what you're looking for",
  },
  propose_profile_details: {
    done: "Suggested profile details",
    doing: "Suggesting profile details",
    failed: "Could not suggest profile details",
  },
  query_metrics: {
    done: "Looked at your numbers",
    doing: "Looking at your numbers",
    failed: "Could not look at your numbers",
  },
  read_document: { done: "Read a document", doing: "Reading a document", failed: "Could not read a document" },
  refine_documents: {
    done: "Worked on your documents",
    doing: "Working on your documents",
    failed: "Could not work on your documents",
  },
  request_review: {
    done: "Asked for a job review",
    doing: "Asking for a job review",
    failed: "Could not ask for a job review",
  },
  search_jobs: {
    done: "Searched your reviewed jobs",
    doing: "Searching your reviewed jobs",
    failed: "Could not search your reviewed jobs",
  },
  set_analytics_tiles: {
    done: "Updated your analytics",
    doing: "Updating your analytics",
    failed: "Could not update your analytics",
  },
  set_application_stage: {
    done: "Moved an application",
    doing: "Moving an application",
    failed: "Could not move an application",
  },
  set_resume: { done: "Updated your résumé", doing: "Updating your résumé", failed: "Could not update your résumé" },
  set_shortlist_state: {
    done: "Updated your shortlist",
    doing: "Updating your shortlist",
    failed: "Could not update your shortlist",
  },
  start_application_prep: {
    done: "Started preparing an application",
    doing: "Starting to prepare an application",
    failed: "Could not start preparing an application",
  },
  update_document_draft: {
    done: "Updated a document draft",
    doing: "Updating a document draft",
    failed: "Could not update a document draft",
  },
};

function known(name: string): ToolLabels | undefined {
  return Object.hasOwn(LABELS, name) ? LABELS[name] : undefined;
}

/** A short past-tense sentence for a tool call; unknown names fall back to readable words. */
export function toolActivityLabel(name: string): string {
  const labels = known(name);
  if (labels) return labels.done;
  const words = name.replace(/_/g, " ").trim();
  return words ? `Used ${words}` : "Used a tool";
}

/** A short present-tense phrase for a running tool call (the working steps row). */
export function toolProgressLabel(name: string): string {
  return known(name)?.doing ?? "Working";
}

/** A short sentence for a tool call that ended in an error. */
export function toolFailureLabel(name: string): string {
  return known(name)?.failed ?? "A step did not work";
}
