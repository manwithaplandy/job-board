import { Badge } from "@/components/ui/Panel";

/**
 * The test-data marker (spec section 9, plan Task 1.20): while discovery is frozen the
 * catalog is test data, and admins see when it was frozen. Everyone else sees nothing.
 */
export function TestDataBadge({ admin, clock }: { admin: boolean; clock: { now: Date; frozen: boolean } }) {
  if (!admin || !clock.frozen || Number.isNaN(clock.now.getTime())) return null;
  return <Badge tone="warning">Test data: catalog frozen at {clock.now.toISOString().slice(0, 10)}</Badge>;
}
