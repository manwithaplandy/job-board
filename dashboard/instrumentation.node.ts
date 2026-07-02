// Node.js-only OTel setup — this file is compiled by the server (Node.js)
// webpack target only; it is never included in the Edge bundle.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { resolveLangfuseHost } from "./lib/langfuseHost.ts";

export const langfuseSpanProcessor: LangfuseSpanProcessor | undefined =
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
    ? new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        // Was `?? "https://cloud.langfuse.com"` — but "" is not undefined, so an
        // empty LANGFUSE_HOST slipped through and broke trace export (wrong
        // region default, too). resolveLangfuseHost handles both.
        baseUrl: resolveLangfuseHost(),
      })
    : undefined;

if (langfuseSpanProcessor) {
  new NodeSDK({ spanProcessors: [langfuseSpanProcessor] }).start();
}
