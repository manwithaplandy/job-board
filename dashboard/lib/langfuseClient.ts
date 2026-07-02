import { LangfuseClient } from "@langfuse/client";

// One shared client; reads keys explicitly (LANGFUSE_HOST is the repo's env name,
// which the classic client expects as baseUrl).
let client: LangfuseClient | null = null;

export function getClient(): LangfuseClient | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }
  if (!client) {
    client = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });
  }
  return client;
}
