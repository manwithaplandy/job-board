import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { JobPreferencesForm } from "@/components/profile/JobPreferencesForm";
import { BackLink } from "@/components/ui/Navigation";
import { requireUserId } from "@/lib/auth";
import { getDistinctLocations, getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Job Preferences · Rolefit" };

const cachedDistinctLocations = unstable_cache(
  (userId: string) => getDistinctLocations(userId),
  ["profile-distinct-locations"],
  { revalidate: 600 },
);

export default async function JobPreferencesPage() {
  const userId = await requireUserId();
  const [profile, locations] = await Promise.all([
    getProfile(userId),
    cachedDistinctLocations(userId),
  ]);
  if (!profile) redirect("/onboarding");

  return (
    <main className="profile-detail">
      <BackLink href="/profile">Back to profile</BackLink>
      <header className="profile-detail-header">
        <h1>Job Preferences</h1>
        <p>Choose where to search and describe what Rolefit should prioritize or avoid.</p>
      </header>
      <JobPreferencesForm profile={profile} locations={locations} />
    </main>
  );
}
