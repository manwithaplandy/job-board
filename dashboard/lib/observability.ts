import type { LangfuseSpanProcessor } from "@langfuse/otel";

export function tracingEnabled(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

// The LangfuseSpanProcessor is created and registered with the OTel tracer
// provider by ensureTracingStarted() below. Route handlers must flush it inline
// before returning, because Vercel freezes the function right after the response
// and cuts off any in-flight immediate-mode export (the parent `resume` span,
// ended last, was the casualty). We CANNOT reach it through a module-level
// `export let`: Next.js bundles route handlers separately, so a route imports its
// own copy of that module whose binding was never assigned and the flush is a
// silent no-op. globalThis is the one slot shared across every bundle in the
// process, so publish the instance there and read it back here.
declare global {
  var __langfuseSpanProcessor: LangfuseSpanProcessor | undefined;
  // Set synchronously (before the first await) by ensureTracingStarted() so
  // overlapping first-calls initialise the provider at most once per process.
  var __langfuseTracingStarted: boolean | undefined;
}

export function setLangfuseSpanProcessor(processor: LangfuseSpanProcessor): void {
  globalThis.__langfuseSpanProcessor = processor;
}

// Start OTel tracing lazily, on the FIRST traced request, instead of eagerly on
// every Node cold boot. Page renders never create spans, so booting the tracer
// provider + LangfuseSpanProcessor in instrumentation's register() taxed every
// board/profile/analytics cold boot for nothing. Only the three generation
// clients trace, and each calls this before opening its first span.
//
// Idempotent + concurrency-safe: a synchronous globalThis flag, set BEFORE the
// first await, makes overlapping first-calls no-op past the guard. The provider
// and processor are dynamically imported so a keyless deploy — or any
// non-generation request — never pays their module-load cost.
export async function ensureTracingStarted(): Promise<void> {
  // The whole body sits inside a NEXT_RUNTIME check because this module reaches
  // client bundles (client components import resumeClient for its constants):
  // Next.js replaces NEXT_RUNTIME with a compile-time constant per bundle, so
  // webpack statically drops this branch — and its Node-only OTel imports — from
  // the client/edge compilations. A runtime `typeof window` guard would NOT do
  // that (the bundler would still try to resolve the imports).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    // No keys → nothing to export to; stay a no-op (mirrors tracingEnabled()).
    if (!publicKey || !secretKey) return;
    if (globalThis.__langfuseTracingStarted) return;
    globalThis.__langfuseTracingStarted = true;

    const [{ NodeTracerProvider }, { LangfuseSpanProcessor }, { resolveLangfuseHost }] =
      await Promise.all([
        import("@opentelemetry/sdk-trace-node"),
        import("@langfuse/otel"),
        import("./langfuseHost.ts"),
      ]);

    const langfuseSpanProcessor = new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      // Was `?? "https://cloud.langfuse.com"` — but "" is not undefined, so an
      // empty LANGFUSE_HOST slipped through and broke trace export (wrong region
      // default, too). resolveLangfuseHost handles both.
      baseUrl: resolveLangfuseHost(),
      // Export on span .end() (SimpleSpanProcessor) instead of the default 5s batch
      // timer. On Vercel a fast (non-timeout) generation returns and the instance
      // freezes before the batch timer fires, dropping the span — so successful
      // traces 404'd while slow (timeout) ones survived. "immediate" is the
      // library's prescribed mode for short-lived serverless functions.
      exportMode: "immediate",
    });

    // NodeTracerProvider.register() wires the AsyncLocalStorage context manager and
    // W3C propagators that NodeSDK.start() used to provide; passing the processor
    // here attaches it identically (LangfuseSpanProcessor is a SpanProcessor).
    new NodeTracerProvider({ spanProcessors: [langfuseSpanProcessor] }).register();

    // Publish on globalThis so route handlers flush THIS instance (the one the
    // provider feeds spans to) at request time — see flushLangfuseTraces below.
    setLangfuseSpanProcessor(langfuseSpanProcessor);
  }
}

// Best-effort: a trace-export failure must never turn a successful generation
// into a 502, so swallow (and log) any error here rather than at the call site.
export async function flushLangfuseTraces(): Promise<void> {
  try {
    await globalThis.__langfuseSpanProcessor?.forceFlush();
  } catch (e) {
    console.error("langfuse flush failed", e);
  }
}
