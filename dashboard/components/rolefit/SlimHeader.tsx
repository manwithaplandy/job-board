// Compatibility adapter for off-board callers. New pages should compose AppShell and
// AppHeader directly; this keeps older route tests and incremental migrations stable.
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { AppHeader, type AppRoute } from "@/components/shell/AppHeader";

export async function SlimHeader({ current }: { current?: Exclude<AppRoute, "board"> }) {
  const claims = await getUserClaims();
  return (
    <AppHeader
      current={current}
      email={claims?.email ?? null}
      isAdmin={isAdmin(claims)}
    />
  );
}
