import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { getSubscription, getViewerPlan } from "@/lib/subscriptions";
import {
  PLAN_LABEL,
} from "@/lib/entitlements";
import { loadTierConfig } from "@/lib/tierConfig";
import { SlimHeader } from "@/components/rolefit/SlimHeader";
import { AppShell } from "@/components/shell/AppShell";
import { ManageBillingButton } from "@/components/billing/BillingActions";
import { Badge, Card } from "@/components/ui/Panel";
import { TierCard } from "@/components/billing/TierCard";
import { PageHeader } from "@/components/ui/Navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · Rolefit" };

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
