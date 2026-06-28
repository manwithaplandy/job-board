import type { LangfuseSpanProcessor } from "@langfuse/otel";

// Populated by register() after server startup (Node.js runtime only).
// Remains undefined when LANGFUSE_PUBLIC_KEY is absent or runtime is Edge.
export let langfuseSpanProcessor: LangfuseSpanProcessor | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Separate .node file keeps Node.js-only OTel deps out of the Edge build.
    // Next.js replaces NEXT_RUNTIME with the compile-time constant 'edge' for
    // the Edge webpack target, so DCE eliminates this import from the edge bundle.
    const mod = await import("./instrumentation.node");
    langfuseSpanProcessor = mod.langfuseSpanProcessor;
  }
}
