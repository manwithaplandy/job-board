import type { Metadata } from "next";
import { HARNESS_ENABLE_ENV, SANDBOX_CASES, isSandboxCaseName, type SandboxLane } from "./fixtures";
import { SandboxHarness } from "./SandboxHarness";

// The server half of the variant 3 sandbox enforcement harness (plan Task 2.7), shared by
// the two paths in SANDBOX_LANES (page.tsx and baseline-csp/page.tsx), driven by
// tests/sandbox/sandbox.spec.ts against a production build. Public: no sign-in, no
// database. The only thing read from the URL is ?case=, and only as a name from the closed
// list in fixtures.ts; the hostile documents themselves are hard-coded there.
//
// The cases send requests to a canary on the visitor's own 127.0.0.1, so they render only
// when the server opts in with SANDBOX_HARNESS=1 (set by the CI job). Anywhere else, a
// preview or production included, the page lists the cases and renders none of them.

export const harnessMetadata: Metadata = { title: "Sandbox harness", robots: { index: false, follow: false } };

export function harnessEnabled(): boolean {
  return process.env[HARNESS_ENABLE_ENV] === "1";
}

export async function HarnessPage({
  lane,
  searchParams,
}: {
  lane: SandboxLane;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams).case;
  const enabled = harnessEnabled();
  if (enabled && isSandboxCaseName(requested)) return <SandboxHarness caseName={requested} lane={lane} />;
  return (
    <main className="rf-gallery" data-sandbox-harness="index" data-sandbox-lane={lane} data-sandbox-enabled={enabled ? "yes" : "no"}>
      <div className="rf-gallery__intro">
        <h1>Sandbox harness ({lane})</h1>
        <p>
          {enabled
            ? "Real-browser enforcement cases for the variant 3 sandbox. Each runs from tests/sandbox/sandbox.spec.ts with ?case= set to one of these names."
            : "The enforcement cases are not enabled on this server."}
        </p>
      </div>
      <ul className="rf-gallery__stack">
        {SANDBOX_CASES.map((c) => (
          <li key={c.name}>
            <code>{c.name}</code>: {c.title}
          </li>
        ))}
      </ul>
    </main>
  );
}
