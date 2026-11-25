import { HarnessPage, harnessMetadata } from "../HarnessPage";

// The "baseline-csp" lane of the sandbox enforcement harness (plan Task 2.7): this path has
// only the site-wide CSP, without frame-src 'none', so a frame's self-navigation is not
// stopped by the parent and the host's own teardown is what the suite tests. It must never
// be added to next.config.mjs's sandbox host entry. See HarnessPage.tsx.

export const metadata = harnessMetadata;

export default function SandboxHarnessBaselineCspPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HarnessPage lane="baseline-csp" searchParams={searchParams} />;
}
