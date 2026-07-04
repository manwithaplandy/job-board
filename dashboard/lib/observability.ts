import type { LangfuseSpanProcessor } from "@langfuse/otel";

export function tracingEnabled(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

// The LangfuseSpanProcessor is created and registered with the NodeSDK in
// instrumentation.node.ts. Route handlers must flush it inline before returning,
// because Vercel freezes the function right after the response and cuts off any
// in-flight immediate-mode export (the parent `resume` span, ended last, was the
// casualty). We CANNOT reach it through a module-level `export let` set in
// instrumentation's register(): Next.js bundles route handlers separately, so a
// route imports its own copy of that module whose binding was never assigned and
// the flush is a silent no-op. globalThis is the one slot shared across every
// bundle in the process, so publish the instance there and read it back here.
declare global {
  var __langfuseSpanProcessor: LangfuseSpanProcessor | undefined;
}

export function setLangfuseSpanProcessor(processor: LangfuseSpanProcessor): void {
  globalThis.__langfuseSpanProcessor = processor;
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
