// The ask_user tool (plan Task 1.17, spec 8.1): a structured question (text, a choice,
// several choices, locations). Its execute returns a fixed acknowledgement and the loop
// stops the turn at the call (stopWhen hasToolCall("ask_user"), lib/agent/loop.ts), so
// the stored part is output-available and the questions stay in the model's history
// on the next turn (PR I3b review I1). The page shows the questions as plain text for
// now; the user answers in their next message.
import { tool } from "ai";
import { z } from "zod";
import type { ToolCtx } from "@/lib/agent/tools";
import { IntakeQuestionsShape } from "@/lib/agent/surfaces/v1/blocks";

export const askUserInput = z.object(IntakeQuestionsShape).strict();
export type AskUserInput = z.infer<typeof askUserInput>;

/** The fixed result of an ask_user call: the questions are on the page, the answers come next turn. */
export const ASK_USER_OUTPUT = { status: "asked" } as const;

export function askUserTool(_ctx: ToolCtx) {
  return tool({
    description:
      "Ask the user 1 to 6 short questions with fixed inputs: text, choice or multi (with 2 to 10 options), or " +
      "locations. Use it for intake (locations, pay floor, deal-breakers, seniority). The turn ends here; the answers " +
      "arrive as the user's next message.",
    inputSchema: askUserInput,
    execute: async () => ASK_USER_OUTPUT,
  });
}
