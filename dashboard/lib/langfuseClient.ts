import { LangfuseClient } from "@langfuse/client";
import { resolveLangfuseHost } from "./langfuseHost.ts";

// One shared client; reads keys explicitly. The base URL goes through
// resolveLangfuseHost so an empty/blank LANGFUSE_HOST can never be handed to
// the SDK as "" (which fails every request with `fetch failed`).
let client: LangfuseClient | null = null;

export function getClient(): LangfuseClient | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }
  if (!client) {
    client = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: resolveLangfuseHost(),
    });
  }
  return client;
}
