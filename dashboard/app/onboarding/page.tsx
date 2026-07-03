import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getProfile, getDistinctLocations } from "@/lib/queries";
import { OnboardingForm } from "@/components/OnboardingForm";
import { completeOnboarding } from "@/app/actions/onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get started · Rolefit" };

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "48px 20px 64px",
};
const cardStyle: React.CSSProperties = {
  maxWidth: "640px", margin: "0 auto", background: "#fff", border: "1px solid #e7eaf0",
  borderRadius: "18px", boxShadow: "0 12px 40px rgba(15,22,35,.08)", padding: "30px 32px 32px",
};

export default async function OnboardingPage() {
  const userId = await requireUserId();
  // A user who already has a profile is done onboarding — send them to the board.
  const existing = await getProfile(userId);
  if (existing) redirect("/");

  const locations = await getDistinctLocations();
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Set up your board
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: "13px", fontWeight: 500, color: "#6b7480", lineHeight: 1.5 }}>
          Add your résumé and the locations you want to search. We&apos;ll start reviewing
          matching jobs on the next cycle.
        </p>
        <OnboardingForm action={completeOnboarding} locationOptions={locations} />
      </div>
    </main>
  );
}
