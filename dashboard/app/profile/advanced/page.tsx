import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdvancedAiForm } from "@/components/profile/AdvancedAiForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
import { getUserClaims, requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";
import { getViewerPlan } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Advanced AI Settings · Rolefit" };

export default async function AdvancedPage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const [profile, plan] = await Promise.all([
    getProfile(userId),
    getViewerPlan(userId, claims?.email ?? null),
  ]);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Advanced AI Settings" description="Choose how much reasoning Rolefit uses when writing your documents." />
      <AdvancedAiForm profile={profile} isPro={plan === "pro"} />
    </main>
  );
}
