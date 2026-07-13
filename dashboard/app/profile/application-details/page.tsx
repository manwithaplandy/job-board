import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplicationDetailsForm } from "@/components/profile/ApplicationDetailsForm";
import { BackLink } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Application Details · Rolefit" };

export default async function ApplicationDetailsPage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail">
      <BackLink href="/profile">Back to profile</BackLink>
      <header className="profile-detail-header">
        <h1>Application Details</h1>
        <p>Keep the contact details and common answers used in your applications up to date.</p>
      </header>
      <ApplicationDetailsForm profile={profile} />
    </main>
  );
}
