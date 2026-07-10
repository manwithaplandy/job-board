import type { Metadata } from "next";
import { AccountSettings } from "@/components/profile/AccountSettings";

export const metadata: Metadata = { title: "Account & App · Rolefit" };

export default function AccountPage() {
  return (
    <main className="profile-detail">
      <header className="profile-detail-header">
        <h1>Account &amp; App</h1>
        <p>Manage your subscription, device appearance, and account data.</p>
      </header>
      <AccountSettings />
    </main>
  );
}
