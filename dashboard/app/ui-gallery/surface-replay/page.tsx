import type { Metadata } from "next";
import { REPLAY_ENABLE_ENV, listReplaySurfaces, loadReplaySurface } from "@/lib/agent/evals/replay";
import { parseStoredSurface } from "@/lib/agent/surfaces/host";
import { ReplayView } from "./ReplayView";

// The render smoke's replay page (plan Task 2.11), driven by tests/sandbox/render-smoke.spec.ts
// against a production build. It renders one recorded or hand-written surface by name, with
// the product's own renderers and the host's own parse rules (variant 3 on), and no session,
// database or server action: a variant 3 frame gets a stub that offers no chip.
//
// The plan calls this page public. Stricter, as the brief asks: it renders only when the
// server opts in with SURFACE_REPLAY=1 (the render smoke's own web server sets it), like the
// sandbox harness. Anywhere else, a preview or production included, it says so and reads no
// file. The only thing read from the URL is ?surface=, and only as a name on the closed list
// in lib/agent/evals/replay.ts. next.config.mjs gives this path the sandbox hosts' CSP.

export const metadata: Metadata = { title: "Surface replay", robots: { index: false, follow: false } };

export default async function SurfaceReplayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const enabled = process.env[REPLAY_ENABLE_ENV] === "1";
  const requested = (await searchParams).surface;
  const entry = enabled ? loadReplaySurface(requested) : null;
  if (entry) {
    const parsed = parseStoredSurface(entry.surface, { variant3Enabled: true });
    return (
      <ReplayView
        name={entry.name}
        variant={entry.variant}
        surfaceId={entry.surface.id}
        threadId={entry.surface.threadId}
        title={typeof entry.surface.payload.title === "string" ? entry.surface.payload.title : entry.name}
        view={parsed.view}
        payload={parsed.payload}
        gathered={parsed.gathered}
        degraded={parsed.degraded}
      />
    );
  }
  const names = enabled ? listReplaySurfaces().map((e) => e.name) : [];
  return (
    <main className="rf-gallery" data-surface-replay="index" data-surface-replay-enabled={enabled ? "yes" : "no"}>
      <div className="rf-gallery__intro">
        <h1>Surface replay</h1>
        <p>{enabled ? "Recorded and hand-written agent surfaces for the render smoke. Open one with ?surface= set to its name." : "Surface replay is not enabled on this server."}</p>
      </div>
      {names.length > 0 && (
        <ul className="rf-gallery__stack">
          {names.map((n) => (
            <li key={n}>
              <code>{n}</code>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
