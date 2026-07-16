import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplicationPersonalizationForm } from "@/components/profile/ApplicationPersonalizationForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Application Personalization · Rolefit" };

export default async function ApplicationPersonalizationPage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Application Personalization" description="Set reusable writing preferences for your tailored application materials." />
      <ApplicationPersonalizationForm profile={profile} />
    </main>
  );
}
