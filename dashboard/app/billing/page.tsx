import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { getSubscription, getViewerPlan } from "@/lib/subscriptions";
import {
  PLAN_LABEL, CHEAP_MODEL, PREMIUM_MODEL, type Plan, type EntitlementMap,
} from "@/lib/entitlements";
import { loadTierConfig } from "@/lib/tierConfig";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { SubscribeButton, ManageBillingButton } from "@/components/billing/BillingActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · Rolefit" };

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "var(--bg-page)", color: "var(--text-primary)", padding: "40px 20px 64px",
};
const wrapStyle: React.CSSProperties = { maxWidth: "760px", margin: "0 auto" };
const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "18px",
  boxShadow: "0 12px 40px rgba(15,22,35,.08)", padding: "26px 28px",
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "var(--text-primary)",
};
const subtitleStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "20px",
};
const tierGridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "20px",
};
const tierCardStyle: React.CSSProperties = {
  background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px",
  display: "flex", flexDirection: "column",
};
const modelName = (id: string) => (id === PREMIUM_MODEL ? "Haiku 4.5 (premium)" : id === CHEAP_MODEL ? "DeepSeek (cheap)" : id);

function TierCard({
  plan, currentPlan, entitlements, prices,
}: {
  plan: Plan;
  currentPlan: Plan | null;
  entitlements: EntitlementMap;
  prices: Record<Plan, number>;
}) {
  const ent = entitlements[plan];
  const caps = Object.entries(ent.stage2Models) as [keyof typeof ent.stage2Models, number][];
  return (
    <div style={tierCardStyle}>
      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>{PLAN_LABEL[plan]}</div>
      <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", margin: "6px 0 2px" }}>
        ${prices[plan]}
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>/mo</span>
      </div>
      <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.9 }}>
        {caps.map(([slot, cap]) => (
          <li key={slot}>
            {cap.toLocaleString()} reviews/day on{" "}
            {slot === "premium" ? modelName(PREMIUM_MODEL) : modelName(CHEAP_MODEL)}
          </li>
        ))}
        <li>{ent.monthlyResume} résumés / mo</li>
        <li>{ent.monthlyCover} cover letters / mo</li>
      </ul>
      <div style={{ marginTop: "auto" }}>
        <SubscribeButton plan={plan} current={currentPlan === plan} />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const [sub, plan, tierConfig] = await Promise.all([
    getSubscription(userId),
    getViewerPlan(userId, claims?.email ?? null),
    loadTierConfig(),
  ]);

  const renewal = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <>
      <SlimHeader current="billing" />
      <main style={pageStyle}>
        <div style={wrapStyle}>
          <div style={cardStyle}>
            <h1 style={titleStyle}>Billing</h1>
            <div style={subtitleStyle}>
              Your plan sets a per-day review budget, the review model, and your monthly
              résumé / cover-letter allowance.
            </div>

            <div style={{
              background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px",
            }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>Current plan</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                {plan ? PLAN_LABEL[plan] : "None"}
                {plan && !sub?.plan && (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent)", marginLeft: "8px" }}>
                    comped (beta invite)
                  </span>
                )}
              </div>
              {sub && (
                <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "6px" }}>
                  Status: {sub.status}
                  {renewal && ` · ${sub.cancel_at_period_end ? "ends" : "renews"} ${renewal}`}
                </div>
              )}
              {sub?.stripe_customer_id && (
                <div style={{ marginTop: "14px", maxWidth: "220px" }}>
                  <ManageBillingButton />
                </div>
              )}
            </div>

            <div style={tierGridStyle}>
              <TierCard plan="standard" currentPlan={plan}
                entitlements={tierConfig.entitlements} prices={tierConfig.prices} />
              <TierCard plan="pro" currentPlan={plan}
                entitlements={tierConfig.entitlements} prices={tierConfig.prices} />
            </div>

            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "18px", lineHeight: 1.6 }}>
              Downgrading keeps your current benefits until the period ends. If you save a
              premium model on a plan that no longer includes it, reviews fall back to the
              cheap model automatically — nothing breaks.
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
