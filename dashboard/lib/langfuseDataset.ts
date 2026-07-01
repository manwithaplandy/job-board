import { LangfuseClient } from "@langfuse/client";
import type { DatasetItem } from "@/lib/rolefit/correction";

// One shared client; reads keys explicitly (LANGFUSE_HOST is the repo's env name,
// which the classic client expects as baseUrl).
let client: LangfuseClient | null = null;

function getClient(): LangfuseClient | null {
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

// Upsert one golden dataset item. No-op when keys are absent (local/dev). The
// same id re-upserts (Langfuse upserts dataset items on `id`), so re-editing a
// correction updates the item in place rather than duplicating it.
export async function upsertDatasetItem(item: DatasetItem): Promise<void> {
  const c = getClient();
  if (c === null) return;
  // Ensure the dataset exists (idempotent; ignore "already exists").
  try {
    await c.api.datasets.create({ name: item.datasetName });
  } catch {
    /* dataset already exists */
  }
  await c.api.datasetItems.create({
    datasetName: item.datasetName,
    id: item.id,
    input: item.input,
    expectedOutput: item.expectedOutput,
    metadata: item.metadata,
  });
}
