import type { Metadata } from "next";
import { SANDBOX_CASES, isSandboxCaseName } from "./fixtures";
import { SandboxHarness } from "./SandboxHarness";

// The variant 3 sandbox enforcement harness (plan Task 2.7), driven by
// tests/sandbox/sandbox.spec.ts against a production build. Public: no sign-in, no
// database. The only thing read from the URL is ?case=, and only as a name from the
// closed list in fixtures.ts; the hostile documents themselves are hard-coded there.
// next.config.mjs gives this path the same route-scoped CSP (with frame-src 'none') as
// /agent, so the frames run under the headers they will have in the product.
//
// The cases send requests to a canary on the visitor's own 127.0.0.1, so on the production
// deployment (VERCEL_ENV=production) the page lists the cases and renders none of them.

export const metadata: Metadata = { title: "Sandbox harness", robots: { index: false, follow: false } };

export default async function SandboxHarnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams).case;
  const enabled = process.env.VERCEL_ENV !== "production";
  if (enabled && isSandboxCaseName(requested)) return <SandboxHarness caseName={requested} />;
  return (
    <main className="rf-gallery" data-sandbox-harness="index">
      <div className="rf-gallery__intro">
        <h1>Sandbox harness</h1>
        <p>
          {enabled
            ? "Real-browser enforcement cases for the variant 3 sandbox. Each runs from tests/sandbox/sandbox.spec.ts with ?case= set to one of these names."
            : "The enforcement cases do not run on the production deployment."}
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
