import type { ReactNode } from "react";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { SettingsNav } from "@/components/profile/SettingsNav";
import { AppShell } from "@/components/shell/AppShell";
import { requireUserId } from "@/lib/auth";
import "./profile-settings.css";

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  return (
    <AppShell header={<SlimHeader current="profile" />}>
      <div className="profile-settings-page">
        <SettingsNav />
        {children}
      </div>
    </AppShell>
  );
}
