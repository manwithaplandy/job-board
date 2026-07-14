import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile, getDistinctLocations } from "@/lib/queries";
import { OnboardingForm } from "@/components/OnboardingForm";
import { completeOnboarding } from "@/app/actions/onboarding";
import { EntryShell } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get started · Rolefit" };

export default async function OnboardingPage() {
  const userId = await requireUserId();
  // A user who already has a profile is done onboarding — send them to the board.
  const existing = await getProfile(userId);
  if (existing) redirect("/");

  const locations = await getDistinctLocations(userId);
  return (
    <EntryShell
      wide
      title="Set up your board"
      description="Add your résumé and the locations you want to search. We’ll start reviewing matching jobs on the next cycle."
    >
      <OnboardingForm action={completeOnboarding} locationOptions={locations} />
    </EntryShell>
  );
}
