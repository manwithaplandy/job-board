import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { isAdmin } from "@/lib/admin";
import { PageHeader } from "@/components/ui/Navigation";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Feedback · Rolefit" };
export default async function FeedbackPage() {
  await requireUserId();
  const claims = await getUserClaims();
  return <AppShell header={<AppHeader email={claims?.email ?? null} isAdmin={isAdmin(claims)} />}><main className="rf-secondary-page"><div className="rf-secondary-wrap rf-secondary-stack">
    <PageHeader title="Feedback" description="Report an issue, share criticism, or suggest a feature." />
    <FeedbackForm />
  </div></main></AppShell>;
}
