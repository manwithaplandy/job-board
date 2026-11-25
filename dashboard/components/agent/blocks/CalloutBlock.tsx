import { Alert } from "@/components/ui/SystemStates";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";

type Callout = Extract<V1Block, { type: "Callout" }>;

/** A short note from the agent, in the shared alert: plain text, info or warning tone. */
export function CalloutBlock({ block }: { block: Callout }) {
  return (
    <Alert tone={block.tone} className="rf-block-callout">
      <span className="rf-block__agent-text">{block.text}</span>
    </Alert>
  );
}
