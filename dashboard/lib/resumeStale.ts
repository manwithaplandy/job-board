// Whether a shown tailored résumé was generated from an older profile than the
// live one — the signal behind the board's "Outdated — regenerate" badge.
//
// Stale requires ALL of: a résumé is actually shown for the job (`hasResume`),
// the stored package carries a `profileVersion` (rows written before that column
// existed are null → provenance unknown, never flagged), a live
// `currentProfileVersion` exists (null for anon / profile-less viewers), and the
// two versions differ. Regenerating restamps the package with the live version,
// which flips this back to false.
export function isResumeStale(args: {
  hasResume: boolean;
  packageProfileVersion: string | null | undefined;
  currentProfileVersion: string | null;
}): boolean {
  return Boolean(
    args.hasResume &&
      args.packageProfileVersion &&
      args.currentProfileVersion &&
      args.packageProfileVersion !== args.currentProfileVersion,
  );
}
