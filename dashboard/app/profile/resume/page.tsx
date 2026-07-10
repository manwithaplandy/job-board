import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResumeSettingsForm } from "@/components/profile/ResumeSettingsForm";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Résumé & Experience · Rolefit" };

export default async function ResumePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail">
      <header className="profile-detail-header">
        <h1>Résumé &amp; Experience</h1>
        <p>Keep the reviewed experience source Rolefit uses for matching and application writing up to date.</p>
      </header>
      <ResumeSettingsForm profile={profile} />
    </main>
  );
}
