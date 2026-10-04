"use server";
import { getUserId } from "@/lib/auth";
import { withUserSql } from "@/lib/db";
import { assertNotDeleted } from "@/lib/tombstone";
import { parseFeedback, type FeedbackResult } from "@/lib/feedback";

export async function submitFeedback(value: unknown): Promise<FeedbackResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in to send feedback." };
  const input = parseFeedback(value);
  if (!input) return { ok: false, error: "Choose a feedback type and enter a message of 1–4000 characters." };
  try {
    await assertNotDeleted(userId);
    await withUserSql(userId, async (tx) => {
      await tx`SELECT public.submit_feedback(${input.kind}, ${input.message})`;
    });
    return { ok: true };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P0001") {
      return { ok: false, error: "You can send up to 5 messages per hour. Please try again later." };
    }
    return { ok: false, error: "Feedback could not be sent. Please try again or sign in again." };
  }
}
