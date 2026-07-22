import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { CompanyFiltersForm } from "@/components/profile/CompanyFiltersForm";
import { JobPreferencesForm } from "@/components/profile/JobPreferencesForm";
import { BackLink, PageHeader } from "@/components/ui/Navigation";
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
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Job Preferences" description="Choose where to search and describe what Rolefit should prioritize or avoid." />
      <JobPreferencesForm profile={profile} locations={locations} />
      <CompanyFiltersForm profile={profile} />
    </main>
  );
}
