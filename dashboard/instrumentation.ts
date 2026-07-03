export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Separate .node file keeps Node.js-only OTel deps out of the Edge build.
    // Next.js replaces NEXT_RUNTIME with the compile-time constant 'edge' for
    // the Edge webpack target, so DCE eliminates this import from the edge bundle.
    // Importing it starts the NodeSDK and publishes the LangfuseSpanProcessor on
    // globalThis (see instrumentation.node.ts); route handlers read it back from
    // there via lib/observability, because a module-level export from here is not
    // reliably visible across Next.js's separate route bundles.
    await import("./instrumentation.node");
  }
}
