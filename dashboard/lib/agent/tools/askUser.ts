// The ask_user tool (plan Task 1.17, spec 8.1): a structured question rendered with
// fixed inputs (text, a choice, several choices, locations). It has no execute: the
// turn ends at the call, and the user's answer arrives as their next message through
// the `answer` intent, keyed by the question id (lib/agent/actions/intents.ts).
import { tool } from "ai";
import { z } from "zod";
import type { ToolCtx } from "@/lib/agent/tools";
import { IntakeQuestionsShape } from "@/lib/agent/surfaces/v1/blocks";

export const askUserInput = z.object(IntakeQuestionsShape).strict();
export type AskUserInput = z.infer<typeof askUserInput>;

export function askUserTool(_ctx: ToolCtx) {
  return tool({
    description:
      "Ask the user 1 to 6 short questions with fixed inputs: text, choice or multi (with 2 to 10 options), or " +
      "locations. Use it for intake (locations, pay floor, deal-breakers, seniority). The turn ends here; the answers " +
      "arrive as the user's next message.",
    inputSchema: askUserInput,
  });
}
