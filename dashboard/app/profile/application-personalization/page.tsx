import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplicationPersonalizationForm } from "@/components/profile/ApplicationPersonalizationForm";
import { BackLink } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Application Personalization · Rolefit" };

export default async function ApplicationPersonalizationPage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail">
      <BackLink href="/profile">Back to profile</BackLink>
      <header className="profile-detail-header">
        <h1>Application Personalization</h1>
        <p>Set reusable writing preferences for your tailored application materials.</p>
      </header>
      <ApplicationPersonalizationForm profile={profile} />
    </main>
  );
}
