import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { getSubscription, getViewerPlan } from "@/lib/subscriptions";
import {
  PLAN_LABEL, type Plan, type EntitlementMap,
} from "@/lib/entitlements";
import { loadTierConfig } from "@/lib/tierConfig";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import { SubscribeButton, ManageBillingButton } from "@/components/billing/BillingActions";
import { Badge, Card } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/Navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · Rolefit" };

// Model-agnostic slot copy: the premium slot unlocks any of the smarter frontier
// models for review (not a single named model); the cheap slot is the standard model.
const slotLabel = (slot: string) =>
  slot === "premium" ? "smarter frontier models" : "the standard review model";

export function TierCard({
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
    <Card className="rf-billing-plan">
      <div className="rf-billing-plan__heading">
        <h2>{PLAN_LABEL[plan]}</h2>
        {currentPlan === plan && <Badge tone="success">Current plan</Badge>}
      </div>
      <div className="rf-billing-plan__price">
        ${prices[plan]}
        <span>/mo</span>
      </div>
      <ul className="rf-billing-plan__features">
        {caps.map(([slot, cap]) => (
          <li key={slot}>
            {cap.toLocaleString()} reviews/day on {slotLabel(slot)}
          </li>
        ))}
        <li>{ent.monthlyResume} résumés / mo</li>
        <li>{ent.monthlyCover} cover letters / mo</li>
        <li>
          {plan === "pro"
            ? "Reasoning effort up to High on résumé / cover-letter generation"
            : "Reasoning effort Off / Low on generation"}
        </li>
      </ul>
      <div className="rf-billing-plan__action">
        <SubscribeButton plan={plan} current={currentPlan === plan} />
      </div>
    </Card>
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
    <AppShell header={<SlimHeader current="billing" />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-stack">
          <PageHeader
            className="rf-secondary-header"
            title="Billing"
            description="Your plan sets a per-day review budget, the review model, and your monthly résumé / cover-letter allowance."
          />

            <Card className="rf-billing-current">
              <div>
                <div className="rf-billing-current__meta">Current plan</div>
                <div>
                {plan ? PLAN_LABEL[plan] : "None"}
                {plan && !sub?.plan && (
                  <> <Badge tone="accent">Comped beta invite</Badge></>
                )}
                </div>
              {sub && (
                <div className="rf-billing-current__meta">
                  Status: <Badge tone={sub.status === "active" ? "success" : "warning"}>{sub.status}</Badge>
                  {renewal && ` · ${sub.cancel_at_period_end ? "ends" : "renews"} ${renewal}`}
                </div>
              )}
              </div>
              {sub?.stripe_customer_id && (
                <div>
                  <ManageBillingButton />
                </div>
              )}
            </Card>

            <div className="rf-billing-plan-grid">
              <TierCard plan="standard" currentPlan={plan}
                entitlements={tierConfig.entitlements} prices={tierConfig.prices} />
              <TierCard plan="pro" currentPlan={plan}
                entitlements={tierConfig.entitlements} prices={tierConfig.prices} />
            </div>

            <div className="rf-billing-current__meta">
              Downgrading keeps your current benefits until the period ends. If you save a
              premium model on a plan that no longer includes it, reviews fall back to the
              standard model automatically — nothing breaks.
            </div>
        </div>
      </main>
    </AppShell>
  );
}
