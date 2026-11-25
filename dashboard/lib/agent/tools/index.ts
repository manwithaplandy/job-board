// The agent's tool set (plan Task 0.10; phase 0 is the read tools only). Every tool gets
// the caller's identity from ToolCtx and never from model input.
import type { Variant } from "@/lib/agent/config";
import type { GatheredData } from "@/lib/agent/gathered";
import { readTools } from "@/lib/agent/tools/read";

export interface ToolCtx {
  userId: string;
  email: string | null;
  threadId: string | null;
  runId: string;
  variant: Variant;
  unattended: boolean;
  gathered: GatheredData;
  repairsLeft: { n: number };
}

// No return annotation on purpose: the object literal's own type keeps each tool's
// input and output types, so InferUITools<ReturnType<typeof buildTools>> gives typed
// tool parts. Annotating it as ToolSet would erase them.
export function buildTools(ctx: ToolCtx) {
  return {
    ...readTools(ctx),
  };
}
