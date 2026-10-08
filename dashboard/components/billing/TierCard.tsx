import { PLAN_LABEL, type Plan, type EntitlementMap } from "@/lib/entitlements";
import { SubscribeButton } from "@/components/billing/BillingActions";
import { Badge, Card } from "@/components/ui/Panel";

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

