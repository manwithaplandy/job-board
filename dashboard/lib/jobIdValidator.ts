// Job ID allowlist: ats:company-token:external-id — no path separators or shell meta.
export const JOB_ID_RE = /^[\w.-]+:[\w.-]+:[\w%.-]+$/;
