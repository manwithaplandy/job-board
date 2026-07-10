import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdvancedAiForm } from "@/components/profile/AdvancedAiForm";
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
    <main className="profile-detail">
      <Link href="/profile">← Back to profile</Link>
      <header className="profile-detail-header">
        <h1>Advanced AI Settings</h1>
        <p>Choose the technical settings Rolefit uses for review and document generation.</p>
      </header>
      <AdvancedAiForm profile={profile} models={models} isPro={plan === "pro"} />
    </main>
  );
}
