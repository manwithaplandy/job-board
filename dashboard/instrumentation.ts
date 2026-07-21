export async function register() {
  // No-op. Tracing used to boot here (import("./instrumentation.node") started
  // the OTel SDK on every Node cold boot), but page renders never trace, so that
  // was pure cold-start tax. Tracing now inits lazily on the first traced request
  // via ensureTracingStarted() in lib/observability.ts.
}
