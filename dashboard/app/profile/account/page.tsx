import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { BackLink, PageHeader } from "@/components/ui/Navigation";

export const metadata: Metadata = { title: "Account & App · Rolefit" };

export default function AccountPage() {
  return (
    <main className="profile-detail profile-page-stack">
      <BackLink href="/profile">Back to profile</BackLink>
      <PageHeader title="Account & App" description="Manage your subscription, device appearance, and account data." />
      <AccountSettings />
    </main>
  );
}
