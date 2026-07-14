import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumeSettingsForm } from "@/components/profile/ResumeSettingsForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Résumé & Experience · Rolefit" };

export default async function ResumePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Résumé & Experience" description="Keep the reviewed experience source Rolefit uses for matching and application writing up to date." />
      <ResumeSettingsForm profile={profile} />
    </main>
  );
}
