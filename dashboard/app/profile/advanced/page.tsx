import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdvancedAiForm } from "@/components/profile/AdvancedAiForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
import { getUserClaims, requireUserId } from "@/lib/auth";
import { getStructuredModels } from "@/lib/openrouter";
import { getProfile } from "@/lib/queries";
import { getViewerPlan } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Advanced AI Settings · Rolefit" };

export default async function AdvancedPage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const [profile, models, plan] = await Promise.all([
    getProfile(userId),
    getStructuredModels(),
    getViewerPlan(userId, claims?.email ?? null),
  ]);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Advanced AI Settings" description="Choose the technical settings Rolefit uses for review and document generation." />
      <AdvancedAiForm profile={profile} models={models} isPro={plan === "pro"} />
    </main>
  );
}
