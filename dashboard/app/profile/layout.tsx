import type { ReactNode } from "react";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { SettingsNav } from "@/components/profile/SettingsNav";
import { requireUserId } from "@/lib/auth";
import "./profile-settings.css";

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  await requireUserId();
  return (
    <>
      <SlimHeader current="profile" />
      <div className="profile-settings-page">
        <SettingsNav />
        {children}
      </div>
    </>
  );
}
