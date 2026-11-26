// The line under an assistant reply that says what the agent did, in plain words
// (PR K1). A raw tool name ("Looked up get profile summary") means nothing to a user.

const LABELS: Record<string, string> = {
  add_application_note: "Added a note to an application",
  get_job: "Read a job posting",
  get_memo: "Read what you're looking for",
  get_profile_summary: "Read your profile",
  get_review: "Read a job review",
  list_applications: "Checked your applications",
  list_documents: "Checked your documents",
  list_shortlist: "Checked your shortlist",
  propose_memo_change: "Suggested a change to what you're looking for",
  propose_profile_details: "Suggested profile details",
  query_metrics: "Looked at your numbers",
  read_document: "Read a document",
  refine_documents: "Worked on your documents",
  request_review: "Asked for a job review",
  search_jobs: "Searched your reviewed jobs",
  set_analytics_tiles: "Updated your analytics",
  set_application_stage: "Moved an application",
  set_resume: "Updated your résumé",
  set_shortlist_state: "Updated your shortlist",
  start_application_prep: "Started preparing an application",
  update_document_draft: "Updated a document draft",
};

/** A short past-tense sentence for a tool call; unknown names fall back to readable words. */
export function toolActivityLabel(name: string): string {
  const known = LABELS[name];
  if (known) return known;
  const words = name.replace(/_/g, " ").trim();
  return words ? `Used ${words}` : "Used a tool";
}
