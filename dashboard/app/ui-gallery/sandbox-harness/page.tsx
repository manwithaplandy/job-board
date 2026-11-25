import { HarnessPage, harnessMetadata } from "./HarnessPage";

// The "frame-src-none" lane of the sandbox enforcement harness (plan Task 2.7): next.config.mjs
// gives this path the same route-scoped CSP (with frame-src 'none') as /agent, so the frames
// run under the headers they will have in the product. See HarnessPage.tsx.

export const metadata = harnessMetadata;

export default function SandboxHarnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HarnessPage lane="frame-src-none" searchParams={searchParams} />;
}
