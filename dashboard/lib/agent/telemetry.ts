// Langfuse tracing for agent turns (plan Task 0.12). The smaller path: the AI SDK's
// own OpenTelemetry integration (@ai-sdk/otel) registered once, on top of the tracer
// provider and LangfuseSpanProcessor that lib/observability.ts starts. streamText then
// emits GenAI spans (model, tokens, tool calls) that the processor exports. Trace-level
// fields (session, tags, metadata) come from propagateAttributes, which the processor
// copies onto every span started inside it, including spans that end after the route
// handler returned (telemetry.tracing.test.ts covers that).
//
// With no Langfuse keys nothing is imported or registered and turns run untraced.
// What reaches a span is what the model and the tools see; the read tools never read
// EEO columns (lib/agent/tools/read.ts), so no EEO field can reach a trace.
import { registerTelemetry } from "ai";
import { propagateAttributes } from "@langfuse/tracing";
import { ensureTracingStarted, tracingEnabled } from "@/lib/observability";
import type { RunKind, Variant } from "@/lib/agent/config";

declare global {
  // The in-flight (or settled) registration; a promise, so overlapping first turns all
  // wait for the same one (as __langfuseTracingInit in lib/observability.ts).
  var __agentTelemetryInit: Promise<void> | undefined;
}

/** Registers the AI SDK's OpenTelemetry integration once per process. Never throws. */
export async function registerAgentTelemetry(): Promise<void> {
  if (!tracingEnabled()) return;
  if (!globalThis.__agentTelemetryInit) {
    globalThis.__agentTelemetryInit = (async () => {
      await ensureTracingStarted();
      const { OpenTelemetry } = await import("@ai-sdk/otel");
      registerTelemetry(new OpenTelemetry());
    })().catch((err: unknown) => {
      // Tracing must never fail a turn. Clear the memo so a later turn retries.
      console.error("agent: telemetry registration failed", err instanceof Error ? err.name : typeof err);
      globalThis.__agentTelemetryInit = undefined;
    });
  }
  await globalThis.__agentTelemetryInit;
}

/**
 * Runs `fn` inside a trace context: session = the thread, tags
 * [agent, variant-N, runKind], metadata { variant, scenario }. Without tracing it
 * simply runs `fn`.
 */
export async function withAgentTrace<T>(
  a: { userId: string; threadId: string | null; variant: Variant | null; scenario?: string; runKind: RunKind },
  fn: () => Promise<T>,
): Promise<T> {
  if (!tracingEnabled()) return fn();
  await registerAgentTelemetry();
  const tags = ["agent", ...(a.variant === null ? [] : [`variant-${a.variant}`]), a.runKind];
  const metadata: Record<string, string> = {};
  if (a.variant !== null) metadata.variant = String(a.variant);
  if (a.scenario !== undefined) metadata.scenario = a.scenario;
  return propagateAttributes(
    {
      userId: a.userId,
      ...(a.threadId === null ? {} : { sessionId: a.threadId }),
      tags,
      metadata,
      traceName: `agent-${a.runKind}`,
    },
    fn,
  );
}
