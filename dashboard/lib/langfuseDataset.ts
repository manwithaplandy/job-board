import type { DatasetItem } from "@/lib/rolefit/correction";
import { getClient } from "@/lib/langfuseClient";

/** One item of any Langfuse dataset (the golden corrections, the agent's variant matrix). */
export interface DatasetRecord {
  id: string;
  datasetName: string;
  input: unknown;
  expectedOutput: unknown;
  metadata: Record<string, unknown>;
}

// Upsert one dataset item. No-op when keys are absent (local/dev). The same id
// re-upserts (Langfuse upserts dataset items on `id`), so re-editing a correction
// updates the item in place rather than duplicating it.
export async function upsertDatasetRecord(item: DatasetRecord): Promise<void> {
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

// Upsert one golden dataset item (review corrections).
export async function upsertDatasetItem(item: DatasetItem): Promise<void> {
  await upsertDatasetRecord(item);
}
