import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplicationDetailsForm } from "@/components/profile/ApplicationDetailsForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Application Details · Rolefit" };

export default async function ApplicationDetailsPage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Application Details" description="Keep the contact details and common answers used in your applications up to date." />
      <ApplicationDetailsForm profile={profile} />
    </main>
  );
}
