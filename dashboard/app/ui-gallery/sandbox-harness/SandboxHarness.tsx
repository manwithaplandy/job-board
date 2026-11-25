"use client";

// The client half of the sandbox enforcement harness (plan Task 2.7). It renders the
// production SandboxFrame with one hard-coded hostile document per frame (fixtures.ts) and
// a stub in place of the two server actions, so the page needs no database and no session.
// The stub mirrors the real describe call's rule that a chip label never comes from the
// frame: it answers from a fixed table keyed by the action name and ignores the args.
//
// What the frames did is written into <output data-sandbox-log="..."> elements as JSON for
// tests/sandbox/sandbox.spec.ts to read: the intents the user's presses ran, the
// fallbacks with their reasons, and the failure reports the stub received.
import { useMemo, useState } from "react";
import type { FrameChip } from "@/app/actions/agent";
import { FIXTURE_GATHERED } from "@/components/agent/blocks/AgentBlocksFixture";
import { SandboxFrame, type SandboxFrameServer, type SandboxSurface } from "@/components/agent/sandbox/SandboxFrame";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import {
  HARNESS_DESCRIBE_DELAY_MS,
  HARNESS_JOB_A,
  HARNESS_JOB_B,
  sandboxCase,
  type SandboxCaseName,
  type SandboxLane,
} from "./fixtures";

const THREAD_ID = "00000000-0000-4000-8000-00000000a001";
const SURFACE_IDS = ["00000000-0000-4000-8000-00000000b001", "00000000-0000-4000-8000-00000000b002"];
export const HARNESS_FALLBACK_TEXT = "Harness fallback: the generated view was removed.";

const SHORTLIST_A: ActionIntent = { name: "shortlist.set", jobId: HARNESS_JOB_A, state: "shortlisted" };
const COMPARE_AB: ActionIntent = { name: "compare", jobIds: [HARNESS_JOB_A, HARNESS_JOB_B] };

/** The stub's fixed chips, by action name. Any other name gets no chip, as an unparsed intent would. */
const HARNESS_CHIPS: Record<string, FrameChip> = {
  "shortlist.set": { label: "Shortlist Senior Product Engineer at Acme Systems", intent: SHORTLIST_A, direct: false },
  compare: { label: "Compare Senior Product Engineer at Acme Systems with Staff Backend Engineer at Globex", intent: COMPARE_AB, direct: false },
};

interface LogEntry {
  surface: string;
  value: unknown;
}

export function SandboxHarness({ caseName, lane }: { caseName: SandboxCaseName; lane: SandboxLane }) {
  const c = sandboxCase(caseName);
  const [intents, setIntents] = useState<LogEntry[]>([]);
  const [fallbacks, setFallbacks] = useState<LogEntry[]>([]);
  const [reports, setReports] = useState<LogEntry[]>([]);

  const surfaces = useMemo<SandboxSurface[]>(
    () =>
      c.frames.map((frame, i) => ({
        id: SURFACE_IDS[i],
        threadId: THREAD_ID,
        payload: { variant: 3, title: `Harness ${frame.tag}`, html: frame.html },
        gathered: FIXTURE_GATHERED,
        fallback: fallbackSurface(FIXTURE_GATHERED, HARNESS_FALLBACK_TEXT),
        rows: {},
      })),
    [c],
  );

  const server = useMemo<SandboxFrameServer>(
    () => ({
      describe: async (_threadId, _surfaceId, name) => {
        await new Promise((resolve) => setTimeout(resolve, HARNESS_DESCRIBE_DELAY_MS));
        return typeof name === "string" && Object.prototype.hasOwnProperty.call(HARNESS_CHIPS, name) ? HARNESS_CHIPS[name] : null;
      },
      report: async (surfaceId, reason) => {
        setReports((r) => [...r, { surface: surfaceId, value: reason }]);
        return null;
      },
    }),
    [],
  );

  return (
    <main className="rf-gallery" data-sandbox-harness={c.name} data-sandbox-lane={lane}>
      <div className="rf-gallery__intro">
        <h1>
          Sandbox harness: {c.name} ({lane})
        </h1>
        <p>{c.title}</p>
      </div>
      <div className="rf-gallery__stack">
        {surfaces.map((s) => (
          <div key={s.id} data-sandbox-surface={s.id}>
            <SandboxFrame
              surface={s}
              server={server}
              onIntent={(surfaceId, intent, source) => setIntents((l) => [...l, { surface: surfaceId, value: { intent, source } }])}
              onFallback={(reason) => setFallbacks((l) => [...l, { surface: s.id, value: reason }])}
            />
          </div>
        ))}
      </div>
      <output data-sandbox-log="intents">{JSON.stringify(intents)}</output>
      <output data-sandbox-log="fallbacks">{JSON.stringify(fallbacks)}</output>
      <output data-sandbox-log="reports">{JSON.stringify(reports)}</output>
    </main>
  );
}
