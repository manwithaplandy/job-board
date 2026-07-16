import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileHub } from "@/components/profile/ProfileHub";
import { requireUserId } from "@/lib/auth";
import { deriveProfileReadiness } from "@/lib/profileReadiness";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile · Rolefit" };

export default async function ProfilePage() {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) redirect("/onboarding");
  return <ProfileHub readiness={deriveProfileReadiness(profile)} />;
}
