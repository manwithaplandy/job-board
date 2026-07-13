import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/AccountSettings";
import { BackLink } from "@/components/ui/Navigation";

export const metadata: Metadata = { title: "Account & App · Rolefit" };

export default function AccountPage() {
  return (
    <main className="profile-detail">
      <BackLink href="/profile">Back to profile</BackLink>
      <header className="profile-detail-header">
        <h1>Account &amp; App</h1>
        <p>Manage your subscription, device appearance, and account data.</p>
      </header>
      <AccountSettings />
    </main>
  );
}
