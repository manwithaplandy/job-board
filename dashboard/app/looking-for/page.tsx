import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getProfile } from "@/lib/queries";
import { getMemo, listMemoVersions } from "@/lib/workspaces/memo";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { MemoEditor } from "@/components/workspaces/MemoEditor";
import { MemoStructured } from "@/components/workspaces/MemoStructured";
import { ActivityPanel } from "@/components/workspaces/ActivityPanel";
import { readActivity } from "@/lib/workspaces/activity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What I'm looking for · Rolefit" };

// "What I'm looking for" (plan Task 1.8). Every read is the signed-in user's, under RLS,
// and the render writes nothing: saving, approving, declining and restoring go through
// the memo actions from the client editor.

export default async function LookingForPage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const email = claims?.email ?? null;

  const [profile, memo, versions, activity] = await Promise.all([
    getProfile(userId),
    getMemo(userId),
    listMemoVersions(userId),
    readActivity(userId),
  ]);
  // The memo compiles into the profile's review instructions, so it needs a profile.
  if (!profile) redirect("/onboarding");

  return (
    <AppShell header={<AppHeader current="looking-for" email={email} isAdmin={isAdmin(claims)} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader
            title="What I'm looking for"
            description="Your search memo guides every review. The agent can propose changes; nothing changes until you approve."
          />
          <div className="rf-workspace-live">
            <MemoEditor memo={memo ?? { version: 0, doc: emptyMemoDoc(), pending: [] }} versions={versions} />
            <section className="rf-ws-section" aria-labelledby="ws-memo-structured">
              <h2 id="ws-memo-structured" className="rf-ws-section__title">
                Locations and company filters
              </h2>
              <MemoStructured locations={profile.preferred_locations} exclusions={profile.company_exclusions} />
            </section>
          </div>
          <ActivityPanel items={activity} />
        </div>
      </main>
    </AppShell>
  );
}
