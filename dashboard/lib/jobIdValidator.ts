// Job ID allowlist: ats:company-token:external-id. The external-id segment may
// itself be a path (Workday ids are `workday:{token}:{externalPath}`, e.g.
// `workday:acme:/job/San-Francisco/Engineer_R-123`), so it allows `/` and `%`
// (percent-encoded values) on top of word chars, dots and dashes. The ats and
// token segments stay slash-free. Bare/colon-less or shell-meta ids still fail.
export const JOB_ID_RE = /^[\w.-]+:[\w.-]+:[\w%./-]+$/;
