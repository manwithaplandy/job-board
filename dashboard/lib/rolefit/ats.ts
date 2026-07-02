// Human-readable labels for the six companies.ats identifiers. Unknown values fall
// back to the raw identifier so an unexpected provider never blanks or crashes.
// Shared by the board's Source facet (FilterBar) and the apply button (ApplicationPanel)
// so provider casing (e.g. "SmartRecruiters") stays consistent across the UI.
export const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};

export const atsLabel = (ats: string): string => ATS_LABELS[ats] ?? ats;
