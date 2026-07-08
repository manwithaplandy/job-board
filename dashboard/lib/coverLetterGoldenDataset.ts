import type { CoverLetterGoldenItem } from "@/lib/rolefit/coverLetterScore";
import { getClient } from "./langfuseClient.ts";

// Upsert one cover-letter-golden dataset item. No-op when keys are absent (local/dev).
// Same id re-upserts (LangFuse upserts on `id`), so re-editing updates in place.
// Mirrors lib/resumeGoldenDataset.ts.
export async function upsertCoverLetterGoldenItem(item: CoverLetterGoldenItem): Promise<void> {
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
