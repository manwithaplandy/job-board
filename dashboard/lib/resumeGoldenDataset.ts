import type { ResumeGoldenItem } from "@/lib/rolefit/resumeScore";
import { getClient } from "@/lib/langfuseClient";

// Upsert one resume-golden dataset item. No-op when keys are absent (local/dev).
// Same id re-upserts (LangFuse upserts on `id`), so re-scoring updates in place.
export async function upsertResumeGoldenItem(item: ResumeGoldenItem): Promise<void> {
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
