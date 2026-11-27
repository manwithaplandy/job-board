# Agent-first redesign: design

Date: 2026-11-19. Status: draft for Andrew's review, after one builder-check pass; all open questions answered by Andrew (2026-11-19 and 2026-11-20). Phase: spec (brainstorm is done; no plan, no code yet).

Grounding: code on `main` at `a478659`; `docs/product.md` and `docs/architecture.md` on branch `claude/project-thread-thhbs3` (not merged); the UX review in `/mnt/project-files/ux-review/` (01 design review, 02 market scan, 03 differentiation, 04 generative-UI research); and today's library check (`research-2026-11-19.md` in the session scratchpad, cited below as "library check"). I did not re-research anything those files cover.

How to read this doc:

- **Decided (Andrew):** his words from 2026-11-19, quoted or closely paraphrased.
- **Settled in brainstorm:** proposals he went along with.
- **Proposal** / **Builder's call:** mine. He has not heard these. Each is rejectable. Section 14 lists the ones most worth checking.
- **[Inference]** is my judgment. **[Unverified]** is a fact I could not confirm.

---

## 1. Intent

### Why

Andrew's concern is that nothing differentiates the product. The design review agrees: the dashboard is a card list, a filter bar and a fit number, and "nothing on screen shows the user an AI that works with them. The AI is a batch scorer whose output is rendered as static fields" (01-design-review). The user's richest signal (corrections, rejects) goes into a form that changes nothing (finding P1-3).

The aim is to use AI in ways competitors do not, so the hunt is easy and collaborative: the user talks to an agent that knows their background, holds an editable picture of what they want, works between visits, and builds the interface the moment calls for.

### Decided (Andrew)

1. "I think the whole process should exist in a chat or chat-like interface, allowing users to upload documents or photos, along with a live voice interface if people prefer to talk directly to it. It should use generative UI to cater the interface and experience to the user dynamically [...] It should use the generative UI to give the agent full control of the interface for the user based on its interaction with the user."
2. Not pure chat: "There should be persistent interfaces, and the agent should have the ability to update the data in them, and the primary agent page should be a fully generative UI for dynamic adaptive workflows."
3. On freedom: "I agree with fixed components like buttons and input boxes for some consistency in the UI, but the experiences that are built should be controlled by the model pretty freely. Maybe we can experiment with a few different alternatives at varying levels of control vs standardization so we can see at what degree of freedom it starts to break down and become confusing."
4. The agent "works between visits".
5. Notifications: "all three long term, but for now let's focus on app only. Note push and email as future enhancements".
6. "It should replace today's dashboard. This currently has no users so I'm not concerned with losing data or confusing people".
7. Workspaces (shortlist, tracker, memo, documents) agreed, plus "a permanent analytics page that the agent can build for the user if the user has specific metrics they want to be able to track regularly and easily without having to prompt for it."
8. Voice: "let's go with just dictation for now."
9. Deferred by him: "we'll rework the cost model, so ignore that issue for now. Same with the fresh jobs; for testing we'll just pretend that whatever is most recent is actually current until we re-enable discovery."

### Settled in brainstorm

- Three rendering variants on the same four scripted scenarios, switchable in prod, to find where freedom becomes confusing (section 7).
- Teach-by-talking: corrections change the "What I'm looking for" memo and future ranking.
- Never auto-apply. Résumé tailoring stays grounded in the user's real experience.
- No model-generated UI may wire a high-risk action without a non-generative confirmation.

### Goals

- G1. One agent page where a user can do the whole hunt by talking, typing, uploading or dictating.
- G2. Five persistent workspaces that the agent can update and that work with the agent switched off.
- G3. What the user says changes what the agent does next (memo, ranking), visibly and reversibly.
- G4. The agent does useful work between visits and reports it in-app.
- G5. A measured answer to "how much UI freedom before it gets confusing", with a decision at the end.

### Non-goals

- Cost model, pricing, plan caps (deferred by Andrew). A hard spend ceiling is still in scope (section 9).
- Re-enabling discovery, lifecycle rollout, the CI/CD migrations effort (referenced, not specified here).
- Live voice, push, email (future work, section 13).
- Submitting applications, outreach, mock interviews, an MCP server.
- Rebrand ("Rolefit" vs job-board stays parked).

### Anti-goals (failure even if it works)

- A chat box bolted onto the old board. If the agent's answers do not change workspace data or the memo, it is the gimmick 03-differentiation warns about.
- The user has to chat to do something a button did faster (triage, mark applied, open a posting).
- The interface changes shape so often that the user cannot find where their shortlist went.
- The agent invents experience, misstates a score or pay figure, or links somewhere other than the real posting.
- Text inside a job posting or an uploaded file causes a write, a leak, or a UI the user did not ask for.
- The agent spends without bound while nobody is watching.
- The agent claims freshness it does not have ("new today") while discovery is frozen.

---

## 2. Constraints

| Area | Constraint | Source |
|---|---|---|
| Stack | Next.js 16.4 / React 19 on Vercel, Supabase Postgres with RLS, Python reviewer on Railway, OpenRouter for all LLM calls, Langfuse, Stripe | architecture.md |
| DB access | postgres.js with `withUserSql` / `withUserMutation` setting `request.jwt.claims`; privileged pool only from an allowlist (`serviceRoleAllowlist.test.ts`) | `dashboard/lib/db.ts` |
| jsonb | Every jsonb read goes through a total parser (never an `as` cast). The same parser validates LLM output and storage reads. zod is allowed (Andrew, 2026-11-20: "I'm happy to use it anywhere it makes sense"); `dashboard/CLAUDE.md`'s "No zod" line is to be updated in the plan. Pin `zod` to `^4.6.7` or later, the version the repo's Oct 28 audit override already requires (the old email-regex ReDoS, CVE-2023-4316, affected only versions before 3.22.3) | `dashboard/CLAUDE.md` |
| UI | Token-only colors, 44px targets, shared primitives, enforced by `ui-contract.test.ts`; every real page must be in `tests/visual/routes.ts` | `docs/ui-contracts.md` |
| Git | Never rewrite commits; commit forward | `CLAUDE.md` |
| Migrations | Applied by hand before the dependent code merges; push to `main` auto-deploys prod; destructive migrations need Andrew's explicit yes. A CI/CD migrations effort is planned separately | architecture.md §8 |
| Reviews | No periodic review exists. `review_requests` rows come only from onboarding and user actions. Railway runs `reviewer.worker`, not the supervisor | architecture.md §3, §9 |
| Data | Discovery frozen since 2026-10-12 (`source_enabled` false). 835,466 jobs | architecture.md §2 |
| Headers | CSP has no `script-src`; `frame-ancestors 'none'`; `X-Frame-Options: DENY`; `Permissions-Policy` sets `microphone=()` | `dashboard/next.config.mjs` |
| Generation | Routes return 202 and run in `after()` with `maxDuration = 300`; client polls `/api/generations` | architecture.md §6 |
| Spend monitoring | The spend-alert service is not deployed in Railway | architecture.md §9 |
| People | One developer | |

Two consequences worth stating early. Dictation needs `microphone=(self)` in the Permissions-Policy. A sandbox iframe served from an app route would be blocked by the current framing headers, which affects the variant 3 design (section 10).

---

## 3. Approaches considered

The product direction is decided. What was open is how the agent's UI is produced and transported.

| | A. AI SDK tool parts + own renderers | B. A2UI 1.0 + `@a2ui/react` | C. json-render | D. One freeform path only |
|---|---|---|---|---|
| What the model emits | Typed tool calls; the client renders `tool-${name}` parts in our components | Declarative JSON over a client catalog | JSON constrained by a zod catalog | HTML/JS |
| Maturity (library check) | `ai` 7.0.177, mainstream | Protocol 1.0 stable since Nov 11; React renderer 0.15.0, pre-1.0 | core 0.23.2, pre-1.0 | n/a |
| Fits three variants | Yes: the variant is just the payload of one render tool | Only variant 2 | Only variants 1-2 | Only variant 3 |
| House-style fit | Our own schemas (zod or hand-rolled) define "valid" | Renderer owns validation | Its zod catalog defines "valid"; fine now that zod is allowed | n/a |
| Risk | We write and own three small renderers | Pre-1.0 renderer; ~202 kB gz measured on 0.9 (04-genui-research) | Pre-1.0 | Cannot compare levels of freedom; highest injection exposure |

**Picked: A, with our own payload grammar per variant.** Reasons:

- The experiment needs all three levels behind one switch with everything else held constant. A is the only option that carries all three.
- It is the lowest-risk stack per the research ("AI SDK tool parts + own components").
- Validation stays in our own schemas, used as total parsers (for zod, `safeParse` returning a value or null), so persisted UI payloads follow the existing jsonb rule.

**Not picked, and why:**

- **A2UI:** the React renderer is pre-1.0 and its 1.0 target is unverified. Proposal: shape the variant 2 grammar close to A2UI's concepts (declarative components over a client catalog, data bound by path) so a later move is a renderer swap, not a redesign [Inference].
- **json-render:** pre-1.0, and it only covers variants 1 and 2. Its zod catalog is no longer a blocker now that zod is allowed, so the plan may still use it for the variant 2 renderer if that is cheaper than writing our own (Builder's call at plan time).
- **AI SDK RSC `streamUI`:** still experimental per 04-genui-research. Avoid.
- **`@ai-sdk/workflow` durable runs:** stability not stated and it likely needs Vercel Workflow [Unverified]. Not a dependency; section 9 uses a plain queue.

**zod.** Decided (Andrew, 2026-11-20): "I don't think we should outright ban zod. I'm happy to use it anywhere it makes sense, whether for tool inputs or for even more." So AI SDK tool inputs, variant payload grammars, the analytics tile spec and persisted jsonb can all be zod schemas. The house rule that survives is the one behind "No zod": no `as` casts across a boundary, every read is a total parse, one schema per shape shared by the LLM-output check and the storage read.

**OpenRouter through the AI SDK.** All LLM traffic goes through OpenRouter today using hand-written fetch (`lib/rolefit/openrouterClient.ts`). The agent loop needs an AI SDK provider pointed at OpenRouter. Whether the community OpenRouter provider tracks AI SDK 7 is [Unverified]; the fallback is an OpenAI-compatible provider with OpenRouter's base URL. Decide in the plan with a spike.

---

## 4. Architecture overview

```
 Browser: agent page (fixed chrome + generated surfaces) and five workspaces
     │  useChat stream            │  server components / actions
     ▼                            ▼
 /api/agent (Next route) ── agent loop (AI SDK) ── OpenRouter
     │ tools run as the session user through withUserSql (RLS)
     ▼
 Postgres: threads, messages, surfaces, memo, shortlist, applications,
           documents, analytics tiles, inbox, agent_actions, agent_runs
     ▲                                   ▲
     │ review_requests                   │ agent_runs (kind=background)
 reviewer.worker (Railway, unchanged scoring)   /api/cron/agent-tick (Vercel Cron)
```

Builder's calls:

- **The agent loop and all tools live in TypeScript** (`dashboard/lib/agent/`). The Python reviewer stays the scoring engine and is driven through `review_requests`, as today.
- **A turn has two steps:** gather (read/write tools) and present (one render tool whose payload grammar depends on the variant). Splitting them lets the same gathered data be re-rendered in another variant, which is what makes the comparison cheap and fair (section 7).
- **Generated UI never carries data it could misstate when that can be avoided.** Variants 1 and 2 reference records by id and the host renders scores, pay, titles and posting links from the database.
- **Every turn must persist even if the client disconnects.** The mechanism in AI SDK 7 needs checking at plan time [Unverified].

---

## 5. User flows

Four scripted scenarios. Each is also an eval fixture (section 11). "Confirm" means a fixed, non-generated card.

### (a) First-time résumé upload

1. New user lands on the agent page. Fixed empty state: one sentence, the composer, an upload target.
2. User drops a PDF or a photo. Server stores it, extracts text (PDF locally with `unpdf` as today; photo through a vision call), creates a `documents` row.
3. Agent calls `read_document`. Fixed facts (name, titles, dates, education) come from the existing deterministic parser (`lib/rolefit/parseProfile.ts`), not the model.
4. Agent presents "here is what I read" for correction, then asks a short intake (locations, which the reviewer requires; comp floor; deal-breakers; seniority intent) through `ask_user`.
5. Agent drafts memo v1 with `propose_memo_change`. Confirm: a fixed diff card (approve, edit, decline).
6. Agent calls `set_resume` (confirm) and `request_review`.
7. Review progress shows in fixed chrome. First picks arrive in the shortlist. If the user leaves, the result lands in the inbox.

| Variant | Rendering |
|---|---|
| 1 | `ProfileReadback`, `IntakeQuestions`, `MemoDiff` blocks in a fixed order the agent can reorder or omit |
| 2 | Agent lays out the same content from Stack/Grid/Text/Field primitives; may merge readback and intake into one form |
| 3 | Agent writes a small guided wizard; answers come back to the host as action intents |

### (b) Compare two jobs

1. User selects two shortlist rows and presses Compare (a fixed button that sends a structured message), or asks in words.
2. Agent calls `get_job` and `get_review` for each, plus `get_memo`.
3. Agent presents a comparison organized by the user's memo criteria: requirements met and unmet, pay, arrangement, red flags, posting age, what is unknown, and a recommendation with its reason.
4. Actions on the surface: shortlist, skip with reason, prepare application.
5. If the user says "I care more about remote than pay", the agent proposes a memo change (confirm) instead of silently re-ranking.

| Variant | Rendering |
|---|---|
| 1 | One `JobComparison` block with a fixed column layout; agent supplies row order and the verdict text |
| 2 | Agent chooses table vs side-by-side cards vs criteria list, built from primitives with bound job fields |
| 3 | Agent may build an interactive view (toggle criteria weights, highlight differences) |

### (c) Prep an application

1. From a shortlist row or by asking. Agent calls `start_application_prep`. Confirm, because it spends the monthly résumé and cover-letter allowance.
2. The existing pipeline runs (`generation_jobs`, the résumé and cover clients, Greenhouse prefill where the posting supports it). The surface shows a checklist: résumé, letter, answers.
3. Agent presents a requirement-to-evidence map (from `job_reviews.requirements` and the résumé), honest gaps, and the grounding checks that already exist (`lib/rolefit/resumeChecks.ts`).
4. User refines by talking ("lead with the GCC High work"). Agent regenerates using the existing per-job instruction fields.
5. Fixed controls: download PDF, copy, "Apply on {ATS}" (link from the database), and after the user returns, "Mark applied". The product never submits.

| Variant | Rendering |
|---|---|
| 1 | `PrepChecklist`, `EvidenceMap`, `DocumentPreview` blocks |
| 2 | Agent composes the workspace; `DocumentPreview` stays a bound primitive |
| 3 | Agent writes the workspace; document preview is passed in as data and rendered by the injected kit |

### (d) Weekly progress

1. User asks "how is my search going", or opens the weekly inbox item.
2. Agent calls `query_metrics` (closed metric catalog, section 6.6) and `list_applications`.
3. Agent presents counts by stage, activity over time, stale applications, shortlist-to-applied conversion, memo changes this week, and one or two suggestions. Every rate shows its n. Per-user samples are small (03-differentiation calls outcome calibration "statistically thin"), so the agent must not present a pattern from five applications as a finding.
4. "Pin to Analytics" on any chart adds a tile to the permanent analytics page.

| Variant | Rendering |
|---|---|
| 1 | `StatRow`, `MetricChart`, `StaleList` blocks |
| 2 | Agent composes a dashboard from Stat/Chart/Table primitives |
| 3 | Agent writes a custom report; charts come from the injected kit |

---

## 6. Surfaces

### 6.1 Agent page (`/`)

Decided: "the primary agent page should be a fully generative UI for dynamic adaptive workflows", with "fixed components like buttons and input boxes for some consistency".

Builder's call on layout:

- **Fixed chrome (never generated):** nav rail to the five workspaces; inbox strip ("since you were here"); composer; variant switcher; thread list; review-progress indicator; confirm cards; undo toasts; error and budget states.
- **Thread:** an agent turn is an ordered stream of text and up to 3 views. Each view renders inside the message at the point where the agent made it. A view has an id and can be updated instead of re-appended, so a workflow (the prep checklist) stays one object; an updated view shows at its newest position and leaves a one-line pointer at the old one. The agent's tool calls are folded into one collapsible steps row at the top of the message, above the answer. (Amended 2026-11-27 by `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 2.1.)
- **All widths:** one conversation column; there is no surface column. Every view has an Expand control that opens it over the whole viewport (a full-screen sheet on phones) with the composer docked at the bottom and still usable. (Amended 2026-11-27 by `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 2.1.)
- **Composer:** text; attach (PDF, image, text; 5 MiB, the existing résumé limit); dictation. Dictated text lands in the composer for editing and is not auto-sent.
- **Threads:** multiple, titled by the agent, listed in chrome. Background findings do not write into threads; they go to the inbox, and opening one starts a thread with that context.
- **Context:** stable cached prefix (profile summary, memo, tool definitions). Job descriptions are fetched by tools, never standing context (04-genui-research: context size drives cost). Long threads are summarized.

Dictation. Proposal: MediaRecorder to a Next route to AI SDK `transcribe` (stable per the library check). Web Speech API is too uneven to rely on. Provider: Groq `whisper-large-v3-turbo` at $0.04/hr or Deepgram Nova-3 at $0.0048/min (library check). This adds a vendor outside OpenRouter, a new key, and a privacy-page change.

How generated and fixed UI coexist: generated surfaces can only **emit action intents** from a closed enum. The host executes them. Anything high-risk opens a fixed confirm card that states the change from database values, not from model text.

### 6.2 Shortlist (`/shortlist`)

Replaces the 500-row board (design review P1-4). States:

| State | Meaning | Set by |
|---|---|---|
| suggested | Agent pick awaiting triage, with a two-line brief (why you, biggest risk) | agent |
| shortlisted | User said yes | user, or agent on request |
| later | Parked | user |
| skipped | Not worth it, with a reason | agent ("I'd skip") or user |

- Every skip carries a `reason_code` and optional text. Agent skip reasons come from data the product has: review red flags, deal-breakers in the memo, missing pay, posting age from `first_seen_at`. Repost counts depend on lifecycle data that is not flowing [Unverified what is available today].
- User skips offer one-tap reasons (pay, location, seniority, schedule, company, stack, stale, other) plus a sentence. A user skip also writes the existing sticky deny (`rejectJob` in `app/actions/jobs.ts`) so the reviewer will not resurrect it.
- A skip reason is the trigger for teach-by-talking: the agent may answer with a memo proposal.
- Agent skips are one tap to override.
- "Browse all" keeps a reduced filterable list for scanning. Chat is weak for that (04-genui-research §3).

### 6.3 Application tracker (`/applications`)

Stages (Builder's call): preparing, ready, applied, interviewing, offer, closed (rejected, withdrawn, no response). Each row: stage history, notes, linked documents, posting link, next-step date. Decided (Andrew, 2026-11-19): "focus only on jobs found within the platform's own discovery". So every tracker row links to a catalog job; no manual entries for outside jobs (listed under future work).

### 6.4 "What I'm looking for" memo (`/looking-for`)

- Plain-language sections: role and seniority, locations and arrangement, compensation, must-haves, deal-breakers, companies and industries, anything else.
- User edits directly. The agent never edits silently: it creates a **proposal** (a diff) that the user approves, edits or declines. Approved proposals create a new version. Versions list who changed what, with restore.
- The memo supersedes `profiles.instructions` and the free-text preference fields. Proposal: on each approved version, compile the memo to text and write it to `profiles.instructions` so the reviewer needs no prompt change. That changes `profile_version` (sha256 of résumé and instructions), which today re-reviews everything. Builder's call 16 covers scoping.
- Structured fields stay structured: preferred locations and company exclusions remain columns, edited from this page.

### 6.5 Documents (`/documents`)

Uploads (résumés, photos, other files), the résumé source of truth (`profiles.resume_text`, unchanged), and generated résumés and cover letters per job (still stored in `application_packages`). The agent can read documents and write drafts. The agent cannot delete. Replacing the résumé source needs confirmation.

### 6.6 Analytics (`/analytics`)

Decided: a permanent page the agent builds for metrics the user wants "without having to prompt for it". On how free (Andrew, 2026-11-20): "I want to lean toward agent-built. I want the users to be able to tailor their metrics page to what they need. But I think it should be a lot more structured than the generative UI in the main agent interaction; a few options for tile sizes, graph/table types, etc, premade components assembled to create cohesive metrics observability [...] sort of a middle ground between the two."

So the page is agent-built from a **fixed kit of premade components**, separate from the experiment's renderers and much more constrained than the agent page:

- **Tile:** `{metric, group_by, filter, window, viz, size, title, note}`, validated by one schema.
- **Metric catalog** (closed, each a tested query): applications by stage, applications over time, response rate, time in stage, shortlist funnel, skip reasons, fit of shortlisted vs applied, weekly activity, stale applications. New metrics are added in code, not by the agent.
- **Viz kit** (Builder's call on the exact list): stat with delta, sparkline, line, bar, stacked bar, funnel, table, list. Built on Recharts (already a dependency) and the existing UI primitives.
- **Sizes:** small (1 column), medium (2), large (full width), on a fixed 4-column grid that collapses to one column on mobile.
- **Layout:** ordered tiles plus optional section headings. The agent assembles and rearranges by talking ("track how long I sit in phone screens"); the user can also reorder, resize and remove tiles directly. Changes are versioned with undo.
- The page renders from the saved spec without a model call, so it stays fast and correct whatever the experiment decides.

The current `/analytics` (operator pipeline stats, about 29 aggregate queries) moves to `/admin/pipeline`.

### 6.7 Who can edit what

| Object | User | Agent (interactive) | Agent (unattended) | Shown and undone how |
|---|---|---|---|---|
| Shortlist state | all | set, with reason | suggest and skip only | "by agent" marker, one-tap undo |
| Tracker stage, notes | all | set on request | none (nudges go to inbox) | marker, undo, stage history |
| Memo | all | propose only | propose only | diff card, versions, restore |
| Résumé source | all | replace with confirm | none | version kept, restore |
| Generated documents | edit, regenerate, delete | generate with confirm, edit drafts | none | "Outdated" flag as today |
| Uploads | add, delete | read | read | n/a |
| Analytics tiles | all | add, change, remove | none | versioned layout, undo |
| Profile application details (contact, EEO, screening answers) | all | propose with confirm; EEO fields never | none | confirm card |
| Account, billing, export, delete | all | none | none | fixed UI only |

Every agent write appends to `agent_actions` with before and after values. Workspaces show a marker on agent-changed rows and an activity panel. Undo is a fixed control that applies the stored inverse.

**Without the agent:** every workspace is a normal server-rendered page on fixed components and existing queries. If the model is down, the budget is spent, or the user has no plan, the workspaces still read and write; only the agent page degrades, with a fixed notice.

---

## 7. The freedom experiment

Settled in brainstorm: three variants, same scenarios, switchable in prod, to find where it "starts to break down and become confusing".

### 7.1 Definitions

All three use one render tool, `present`, and the same action enum. Only the payload grammar differs. A turn may call `present` up to 3 times. (Amended 2026-11-27 by `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 2.2.)

| | 1. Domain blocks | 2. Primitives + tokens | 3. Sandboxed code |
|---|---|---|---|
| Model emits | Ordered list of blocks from a fixed job-domain catalog (about 12-15: `JobCard`, `JobComparison`, `ShortlistQueue`, `MemoDiff`, `PrepChecklist`, `EvidenceMap`, `DocumentPreview`, `StatRow`, `MetricChart`, `IntakeQuestions`, `ProfileReadback`, `StaleList`, `Callout`) with ids and short text props | A tree of about 20 primitives (Stack, Grid, Card, Heading, Text, Stat, Table, Chart, Badge, List, Divider, Tabs, Button, Field, Select, plus bound atoms `JobTitle`, `FitScore`, `Pay`, `PostingLink`) styled only by token enums; data bound by path into a server-supplied data object | One self-contained HTML document (markup, CSS, JS) written against an injected kit: design tokens as CSS variables, layout and typography classes, control elements (`<jb-button>`, `<jb-field>`, `<jb-select>`, `<jb-slider>`, `<jb-toggle>`, `<jb-tabs>`), chart, table, format and element helpers, and a `host` bridge with `action` and `ask` |
| Client renders | Our React components | Our generic tree renderer | An iframe with no network (section 10) |
| Model controls | Which blocks, order, emphasis, copy | Layout, grouping, hierarchy, which data, copy | Everything inside the frame, including interaction |
| Validated by | Total parser: known block, prop shapes, ids resolve and belong to the user, actions in the enum | Total parser: known nodes, depth and node caps, token-only styles, bindings resolve, actions in the enum, basic a11y rules (labels, heading order, table headers) | Static checks (size cap, no external URLs, no `form`, `iframe`, `link`, `base`, `meta http-equiv`, `object`), then a runtime handshake; errors and height reported over the bridge |
| On failure | Text plus a default block | One repair attempt with the errors fed back, then fall back to variant 1 | No handshake within a timeout, or a runtime error: fall back to variant 1 |
| Misstating data | Not possible for bound fields | Not possible for bound atoms; possible in free text | Possible; measured in evals |

Agent-authored text in every variant is plain text. No model-authored links or images: posting links are rendered by the host from the database.

### 7.2 The switch

Proposal:

- `agent_settings.default_variant` per user. Each thread records the variant it was created with. Each surface row records the variant, model, validation outcome, latency and token counts that produced it.
- The switcher sits in the agent page chrome. Changing it applies to later turns in that thread; earlier surfaces keep rendering in the variant that produced them.
- "Re-render as..." on any surface re-runs only the present step with the same gathered data in another variant and shows the two results as tabs. This is the main comparison tool.
- Decided (Andrew, 2026-11-19): "just roll all 3 out together. Like I said there are no users so this is all dev essentially." All three variants are available to every signed-in user with a plan, with no admin gate. The variant 3 sandbox and its injection protections (section 10) stay in full, because the injection risk comes from job postings, not from who the user is.

### 7.3 How the comparison works

| Layer | What | How |
|---|---|---|
| Scripted runs | 4 scenarios x 3 variants x 2-3 seeded personas x 5 repeats, same model and same gathered data | Offline harness against a seeded test user; results to a Langfuse dataset |
| Automatic measures | Validation failure rate; repair rate; fallback rate; time to first render and to complete; output tokens; deterministic task asserts (section 11); structural variance across repeats (how different are five layouts for the same input) | Harness |
| Demos | Andrew demos the prototypes to people and gathers their feedback | His notes; no scoring scheme imposed |
| Production signals | Fallback rate; "re-render as" use; undo within a minute of an agent action; the user re-asking the same thing; abandoning a surface for a workspace | `agent_runs` and surface rows |

Things worth watching for in demos (a checklist, not a score): not finding the primary action; mispredicting what a control does; not recognizing the same task when it is laid out differently the second time; needing to ask the agent how to use what it just built.

Model fairness. A weak model writing code can look like "freedom breaks" when it is really "model too weak" [Inference]. Proposal: run the matrix once with one cheap default model for all variants, and once with a stronger model, and report both (builder's call 20).

**Decision:** Andrew decides (2026-11-20): "I'll demo it to people and give you a decision one way or another. That isn't going to be something with objective metrics; it'll come from my opinions after seeking feedback from some initial user testing across the different prototypes." The automatic measures and production signals above are supporting information for that call, presented as a short per-variant summary, not a pass/fail gate. The one hard line is security: a variant that fails the injection set is fixed before it is demoed further. A mixed outcome is legitimate [Inference]: for example variant 2 by default with variant 1 blocks for anything carrying actions.

Expectation to test, not a result: the research found generated UI beat chat text on 69-84% of curated queries but only 50.8% on real ones, and was strongest on dense structured content (04-genui-research §3). So scenarios (b) and (d) are where freedom should help most and (a) and (c), which are step-by-step, where it should help least.

---

## 8. Tools and data model

### 8.1 Tool surface

Every tool runs server-side as the session user through `withUserSql` or `withUserMutation`. No tool accepts a user id. Job ids are validated (`lib/jobIdValidator.ts`).

| Tool | Contract | R/W | Confirm |
|---|---|---|---|
| `get_profile_summary` | Parsed résumé facts, locations, application details minus EEO fields | R | |
| `get_memo` | Current memo and pending proposals | R | |
| `search_jobs` | Jobs already reviewed for this user, by structured filters, sorted, capped. Catalog-wide search is future work (section 13, search upgrade idea) | R | |
| `get_job` | Posting fields and description (wrapped as untrusted) | R | |
| `get_review` | Verdict, sub-scores, gaps, requirements, red flags | R | |
| `list_shortlist` / `list_applications` | Rows by state or stage | R | |
| `list_documents` / `read_document` | Metadata; extracted text (wrapped as untrusted) | R | |
| `query_metrics` | Run one metric spec from the closed catalog | R | |
| `get_inbox` | Unread background findings | R | |
| `present` | Render or update a surface (variant grammar) | UI | |
| `ask_user` | Structured question rendered with fixed inputs | UI | |
| `set_shortlist_state` | Set state with reason | W | no, undoable |
| `set_application_stage` / `add_application_note` | Tracker changes | W | no, undoable |
| `set_analytics_tiles` | Replace the tile list | W | no, undoable |
| `request_review` | Enqueue a review, scoped or full, within budget | W | no |
| `propose_memo_change` | Create a diff for approval | W | yes (the diff card) |
| `update_document_draft` | Edit a generated cover letter | W | no, undoable |
| `start_application_prep` | Generate résumé, letter, prefill for a job | W | yes (spends allowance) |
| `set_resume` | Replace the résumé source of truth | W | yes |
| `propose_profile_details` | Fill contact and screening answers from a document | W | yes |
| `post_inbox_item` | Background runs only | W | no |

Deliberately absent: submit an application, send any message, fetch a URL, delete a document, export or share data, change billing, delete the account. Those exist only as fixed UI or not at all.

Confirmation uses the AI SDK tool-approval states (`approval-requested`, `approval-responded`, `output-denied` per the library check) rendered by our fixed card.

### 8.2 Data model (high level)

All new tables carry `user_id`, have RLS enabled, and follow the existing owner pattern (`user_id = app_user_id()`). All changes are additive. No drops in this project without Andrew's explicit yes.

| New table | Purpose | User access |
|---|---|---|
| `agent_threads` | Thread, title, variant, summary | owner CRUD |
| `agent_messages` | Turn parts as jsonb (total parser on read) | owner read; server writes |
| `agent_surfaces` | Payload, variant, model, validation outcome, timings, supersedes | owner read |
| `agent_runs` | One row per interactive turn or background run: kind, status, tokens, cost, steps | owner read |
| `agent_actions` | Audit of agent writes with before/after for undo | owner read |
| `agent_settings` | Default variant, background on/off | owner CRUD |
| `agent_inbox_items` | Background findings, read and dismissed timestamps | owner read, update read state |
| `search_memos`, `search_memo_versions`, `search_memo_proposals` | Memo, history, pending diffs | owner CRUD on memo; proposals owner read plus resolve |
| `shortlist_items` | `(user_id, job_id)`, state, reason code and text, set by | owner CRUD |
| `applications`, `application_events` | Tracker stage and history; `job_id` required (catalog jobs only) | owner CRUD |
| `documents` | Uploads and extracted text, storage path | owner CRUD |
| `analytics_tiles` | Saved tile specs and order | owner CRUD |

Tables users must not be able to forge (`agent_runs`, `agent_actions`, `agent_surfaces`, usage) are read-only to the `authenticated` role and written through `SECURITY DEFINER` functions, the pattern `submit_feedback()` already uses. Grants matter here because default privileges are re-granted from an allowlist and the anon key can reach PostgREST.

| Existing | Change |
|---|---|
| `job_reviews` | Unchanged. Still the score and the sticky-deny mechanism |
| `review_requests` | Add a scope (full, or a job list) so a memo change can re-score the shortlist only. Needs a small reviewer change in candidate selection |
| `application_packages`, `generation_jobs` | Reused as the document artifact store and generation queue. `status prepared/applied` is superseded by `applications.stage`; backfill applied rows |
| `usage_counters` | New kinds for agent spend (read-only to users already) |
| `profiles` | `resume_text` stays the source of truth. `instructions` becomes the compiled memo. `board_filters`, the `model_*` columns and reasoning-effort columns stop being read; columns stay |
| `review_corrections` | Kept for the admin golden dataset. The user-facing correction form is removed |
| `app_settings` | Add agent kill switches and ceilings |
| `matching_activity` | Unchanged; agent conversation should count as meaningful activity (Builder's call) |

Also required and easy to forget: account export (`lib/accountExport.ts`) and deletion (`lib/accountDeletion.ts`) must cover every new table and the uploads; the privacy page must mention conversation content in Langfuse traces (not deleted today) and the dictation provider.

### 8.3 Routes

| Current | Fate |
|---|---|
| `/` signed-in board, `RolefitBoard`, `FilterBar`, `ReviewNowPanel` | Removed. `/` becomes the agent page. A reduced list survives as "Browse all" in the shortlist |
| `/onboarding` | Removed. Scenario (a) replaces it |
| `/companies` | Removed from user nav. Include/exclude moves into the memo page. Admin classification stays |
| `/analytics` | Operator view moves to `/admin/pipeline`. `/analytics` becomes the user's page |
| `/profile/job-preferences`, `/profile/application-personalization` | Absorbed by the memo |
| `/profile/resume` | Absorbed by Documents |
| `/profile/advanced` (model pickers) | Removed. Model choice goes away until the cost model rework |
| `/profile/application-details`, `/profile/account`, `/billing`, `/feedback`, auth pages, `/privacy`, `/terms`, `/admin/*` | Kept |
| `/board` (logged-out public list) | Kept as is; a real landing page is out of scope here |
| `lib/schedules.ts` copy ("every 2 hours") | Removed or made true by section 9 |
| `/api/resume`, `/api/cover-letter`, `/api/application/prepare`, `/api/generations` | Kept; called by the prep tool and by Documents |

New: `/api/agent`, `/api/agent/transcribe`, `/api/agent/upload`, `/api/cron/agent-tick`, and the five workspace routes. Every new page goes into `tests/visual/routes.ts`.

---

## 9. Background work between visits

Decided: the agent "works between visits". In-app only for now.

### What it does unattended (proposal)

| Job | LLM? | Output |
|---|---|---|
| Queue a review for each active user on a schedule | reviewer only | New scored jobs |
| After a review finishes: pick the best new jobs, write briefs and skip reasons | yes | Shortlist `suggested` and agent `skipped` rows, one inbox digest |
| After an approved memo change: scoped re-review, then say what moved | reviewer plus a short summary | Inbox item ("3 dropped, 1 surfaced") |
| Tracker nudges: applied N days ago with no update; next-step date reached | no | Inbox item |
| Shortlisted posting closed or changed | no | Inbox item. Dormant until discovery runs again |
| Weekly progress digest | yes | Inbox item that opens scenario (d) |

Unattended runs may read, suggest, skip with a reason, and post to the inbox. They may not change the memo, generate documents, change tracker stages, or touch the profile. They get no confirmation path, so anything needing one waits as a proposal.

### Triggers and where it runs

- Today there is no periodic review and Railway runs `reviewer.worker` with no cron (architecture.md §3, §9). This project has to add the schedule.
- Proposal: **Vercel Cron** calls `/api/cron/agent-tick` (authenticated by a secret). Each tick picks due users, enqueues `review_requests` (the existing worker drains them), claims pending `agent_runs` with `FOR UPDATE SKIP LOCKED`, and runs them inside the 300 s function limit. Runs execute as the target user through `withUserSql`, so RLS applies to background work too.
- Why not Railway: the tools are TypeScript, and a second agent implementation in Python would drift. Cron frequency limits on the current Vercel plan are [Unverified].
- Cadence proposal: one review plus digest per active user per day. The existing 7-day inactivity pause for non-paying accounts keeps applying.
- Frozen data: until discovery is back, a daily review finds nothing new after the first pass. For testing, per Andrew, treat the newest data as current. Proposal: one "catalog clock" helper that returns `max(jobs.last_seen_at)` instead of `now()` while `source_enabled` is false, used for age labels and "new" badges, with a visible "test data" marker for admins. One switch to remove later instead of scattered special cases.

### Inbox

A strip at the top of the agent page: unread items since the last visit, newest first, each a fixed card (not variant-rendered, so it is always scannable and costs nothing to show). Opening one starts a thread seeded with that item. Workspace nav shows an unread count. Push and email are future work.

### Budgets and guardrails

The cost model is deferred. A ceiling is not optional once work runs without the user present. Proposal:

- **Per-user hard ceilings**, daily and monthly, in micro-dollars in `usage_counters`, checked before every model call, interactive and background. Over the ceiling: the agent page shows a fixed notice and workspaces keep working.
- **Per-run caps:** maximum tool-loop steps, output tokens, wall-clock.
- **Background caps:** at most one digest run per user per day; no retries beyond one.
- **Global kill switches** in `app_settings`: agent on/off, background on/off, variant 3 on/off.
- **Backstops:** the OpenRouter key limit (the reviewer already halts on `OutOfCreditsError`), and deploying the spend-alert service that exists in the repo but not in Railway before background runs go live.
- Ceiling values are placeholders to set from measured cost per scenario in phase 1. I am not proposing numbers without measurements.

---

## 10. Security

### Threat model

Job postings are third-party text. Uploaded documents and photos are too: a résumé PDF can carry hidden instructions as easily as a posting. Company blurbs from ATS boards are the same class (the reviewer already guards them, `reviewer/llm.py`). The attacker's goals: make the agent write something (skip good jobs, alter the memo, burn allowance), exfiltrate the user's résumé or contact details, or show the user a misleading UI.

### Controls for every variant

| Control | Detail |
|---|---|
| Untrusted wrapping | All posting and document text enters context inside the guarded block used today (`untrustedJobDescriptionBlock` in `lib/rolefit/promptPolicy.ts`). Necessary, not sufficient |
| Authorization in code, not in the prompt | Tools derive the user from the session, run under RLS, and validate ids. The model cannot name another user's data |
| No egress tools | The agent has no fetch, search or send tool |
| No model-authored links or images | Text renders as plain text. Posting links come from the database. This closes the markdown-image and link exfiltration paths |
| Closed action enum | Generated UI emits intents; the host maps each to a registered handler. Unknown intent: dropped and logged |
| Non-generative confirmation | High-risk and spending actions open a fixed card that states the change from database values. The model cannot write the card's text |
| Reversibility | Low-risk writes are logged with before/after and are one-tap undoable |
| Data minimization | EEO fields never enter agent context. Contact details enter only for prefill, which is the existing fixed pipeline |
| Unattended limits | Section 9: no memo, document, stage or profile writes without the user |
| Uploads | Type and size checks server-side; files stored under a per-user path; the server reads only paths it generated (the library check notes client attachment URLs are untrusted) |
| Tracing | Every run in Langfuse tagged with variant and scenario |

Residual risk in variants 1 and 2: an injected instruction can still steer low-risk, undoable writes and the agent's wording. The design accepts that and relies on visibility and undo.

### Variant 3 sandbox

Facts from the library check, then the design.

- An iframe with `sandbox="allow-scripts"` only (no `allow-same-origin`, forms, popups, top-navigation, modals, downloads) loaded by `srcdoc` gets an opaque origin: no cookies, no storage, no access to the parent DOM.
- `srcdoc` inherits the embedder's CSP and policies intersect. A meta CSP inside the frame can only tighten. The app's CSP has no `script-src` today, so inline script in the frame runs; a future nonce-based parent CSP could break it. Test this.
- Use meta CSP `default-src 'none'` with a script nonce or hash. `connect-src` alone does not cover images, forms or navigation.
- **Residual leaks the CSP does not close:** the frame can navigate itself (`location =`, meta refresh; `navigate-to` was dropped from CSP), DNS prefetch (add `x-dns-prefetch-control: off`), and anything the host copies out.
- The research recommendation for maximum safety is a separate origin or subdomain with a real CSP header. ChatGPT uses a double-iframe proxy on a separate origin.

Design (proposal):

1. **Phase 2 (ships to everyone):** `srcdoc` iframe, `sandbox="allow-scripts"`, meta CSP `default-src 'none'` plus nonce'd inline script and style, `img-src data:`. The host injects the kit and the generated document.
2. **Bridge:** `postMessage` JSON. Host to frame: `init {data, theme}`. Frame to host: `ready`, `inited`, `pong`, `resize {height}`, `action {name, args}`, `ask {text}`, `escape`, `error {message}`, `navigating`. An `ask` is only a request, like an `action`: the host shows its exact text on app chrome and sends it as the user's message only when the user presses Send there. A turn started that way cannot run an unconfirmed write. (Amended 2026-11-27 by `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 2.3.) The rest of this item stands: Because the origin is opaque, the host validates `event.source === iframe.contentWindow` and the message schema on every message. Actions go through the same enum and confirm cards as every other variant. The frame gets a data snapshot; it has no read tools.
3. **Self-navigation is the open hole.** A frame can leak the data it was given by navigating itself to an attacker URL with the data in the query string. Mitigations, layered: (a) static rejection of external URL strings, `location`, `meta http-equiv`, `form`, anchors with `href`; this is bypassable by obfuscation and is defense in depth only; (b) the host tears down the frame on any second `load` event, which limits but does not prevent one request; (c) a parent `frame-src` policy that only permits the sandbox origin, which should cover navigations of the child frame [Unverified, must be tested per browser]; (d) the data snapshot excludes contact details and anything the surface does not need.
4. **Before real users arrive** (i.e. before discovery is re-enabled or the product opens up; Builder's call): move the frame to a separate origin with a header CSP (the current `frame-ancestors 'none'` and `X-Frame-Options: DENY` would need a scoped exception for that origin), and pass an injection test set where seeded postings and documents try to exfiltrate and to wire unconfirmed writes.
5. Height cap, handshake timeout, and a visible "generated view" frame so the user can tell agent-written UI from product chrome. (Item 5's frame is now the shared view frame of `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 5.)

Honest summary: variants 1 and 2 are safe by construction for data integrity and nearly so for exfiltration. Variant 3 is containable for writes (everything still goes through tools and confirms) but its exfiltration story depends on browser behavior that needs testing. With no users today the exposure is test accounts, which is why it can ship to everyone now; the separate-origin work and the injection set are what make it fit for real users.

---

## 11. Evals

Sized for one developer. Reuses what exists: vitest, Playwright, `axe-core` (already a dev dependency), Langfuse datasets, the `/ui-gallery` fixture routes.

| Layer | What | When |
|---|---|---|
| 1. Runtime gate | Every `present` payload passes its variant's validator or falls back. Failure, repair and fallback rates logged per model and variant | Always, in prod |
| 2. Golden scenarios | The four scenarios x 2-3 seeded personas to start (about 12), growing toward 30-50 as real failures are found. Record tool calls and the surface payload | On every prompt, model or catalog change |
| 3. Deterministic asserts | Displayed score, pay and title equal the database values (free for bound fields; checked against rendered DOM text for variant 3). Every posting link is the stored URL. Every action maps to a registered handler. No write tool ran without its confirmation. The memo was not changed outside a proposal. Tailored résumé passes the existing `resumeChecks` | With layer 2 |
| 4. Render smoke | Playwright renders each recorded surface inline and expanded, at 390 and 1440 wide, light and dark: no overflow, 44px targets, axe clean, one screenshot kept for eyeballing (not pixel-diffed, since output is non-deterministic) | With layer 2 |
| 5. Injection set | Seeded postings and documents containing instructions. Pass means no unconfirmed write, no external URL in output, no navigation from the sandbox | With layer 2, and gating variant 3 |
| 6. Judge | LLM judge only for A/B between variants, from a different model family than the generator, with about 10% hand-checked. The research puts single-judge agreement with humans at 69%, so the judge informs and does not decide | During the comparison |
| 7. Structural diff | Component-tree diff across repeats and across model versions for variants 1 and 2 | With layer 2 |

The checks added by the inline UI work (at most 3 surfaces per turn, per-view asserts and misstatements, the `*-ask` injection families, views-per-turn and interactive-rate measures, one judge question) are listed in `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 15.2 and belong to this table. (Amended 2026-11-27 by `docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md` section 2.4.)

Not planned: browser agents as testers. The cited benchmark shows low agent task success (24.5% to 31.5%), which is too noisy to act on.

Variant 3 cannot satisfy the static UI contract scanner, by nature. Its only a11y and target-size checks are layer 4 and the demos. That is a real cost of freedom and should weigh in the decision.

For the variant comparison, see section 7.3. The harness for layer 2 and the scripted runs are the same code.

---

## 12. Rollout phases

Not a plan. Order is by uncertainty: the rendering question first, because it shapes the agent page.

| Phase | Ships | Exit |
|---|---|---|
| 0. Foundations | Additive migrations; agent loop with read tools over existing data; thread persistence; `agent_runs` and the spend ceiling; OpenRouter provider spike; Langfuse tracing | A signed-in user can ask about their reviewed jobs and get text back within budget |
| 1. Variant 1 and thin workspaces | `present` with domain blocks; deterministic "suggested" fill (builder's call 17); write tools with confirm cards and undo; shortlist, tracker, memo, documents as plain pages; uploads; the four scenarios end to end; golden scenarios and asserts | All four scenarios pass asserts in variant 1; cost per scenario measured |
| 2. The experiment | Variants 2 and 3 for everyone, the switcher, "re-render as", the harness, injection set, Andrew's demos | A written decision on the rendering level |
| 3. Cutover | Agent page as `/`; old board, onboarding, companies, advanced AI and profile sections removed; analytics tiles page; dictation; visual manifest updated; export, deletion and privacy copy updated | Old dashboard code deleted |
| 4. Between visits | Cron tick, scheduled reviews, digests, nudges, inbox, kill switches; spend alert deployed | A user who stays away for three days returns to a correct, capped inbox |
| 5. Harden | Sandbox on a separate origin if variant 3 survives (required before real users); thresholds tuned from production signals | |

There are no users, so cutover needs no migration period or feature flag for the old UI. Migrations stay manual and are applied before the code that needs them merges; if the CI/CD migrations effort lands first, use it.

---

## 13. Future work

- **Push and email notifications** (Andrew: "all three long term"). The inbox item is the unit; push and email become additional deliveries of the same item. Email reuses the existing SES path.
- **Live voice.** Deferred by Andrew in favor of dictation. The research suggests one agent loop with voice as another I/O channel driving the same tools and surfaces.
- **Cost model rework.** Plans, caps, model defaults, whether dictation and background work are paid features. Phase 1 measurements feed it.
- **Discovery re-enable**, then removal of the catalog clock helper; repost and closure signals for skip reasons.
- **A2UI** behind the variant 2 grammar once its React renderer is stable.
- **MCP server** exposing the scored shortlist, memo and tracker to the user's own assistant (03-differentiation idea 4).
- **Outcome loop:** suggesting memo changes from response patterns, only as prompts, given small samples.
- **Background pre-drafting of application documents** for the agent's top picks. Andrew (2026-11-20): "could be a future enhancement once we understand usage and how it'll effect the cost model, but that would be well down the road." Would need a per-day cap and a "drafted for you" state.
- **Search upgrade:** see the parked idea below.
- **Logged-out landing page** in place of the public list.
- **Jobs from outside the catalog** (pasted text, screenshots, manual tracker entries, tracker import from email). Out of scope by Andrew's decision on 2026-11-19.

---

### Idea parked for later: embed the catalog once, per-user relevance (search upgrade)

Decided (Andrew, 2026-11-19): "Let's push the search upgrades for now until we finish the UX/UI design overhaul, but I want to note this as an idea so if we start exploring it again, we can come back to this conceptually." Why he likes it: "I just like the idea of embedding the whole catalog once, and each user having their own relevance classification from that. I was really worried about how the current architecture would scale." Until then, the agent works only with jobs the reviewer has already scored for the user.

Andrew asked (2026-11-19) whether Venn could help "find and suggest jobs for each user from our jobs database for a low cost with a decisions model like Jev". Research on the same day (library check addendum, sources in the task notes):

- **Venn** (`markrussinovich/venn-vdm`, MIT code, model weights on Hugging Face under their own terms) is a "research preview" by Mark Russinovich (author per Andrew, which lends it credibility): 8 stars, 2 commits, no releases, no PyPI package found. It answers typed questions (Choice, Score, yes/no, nearest reference, outliers) over embeddings with a small head, and can train custom heads (linear or residual Choice, numeric) from labeled vectors. Its generic head expects vectors from its frozen 768-d `embeddinggemma-2` reader (~1.5 GB). The author's own caveats: probabilities not calibrated, benchmarks self-run. **Verdict as of 2026-11-19:** the author is credible, but the project has no releases yet. When this idea is picked up, either evaluate Venn then or build the same thin layer (a logistic or ridge head over stored vectors) ourselves.
- **Jev** is real: TypeSafe's hosted structured-decision model on OpenRouter (`typesafe/jev-1.14`, Decisions API, alpha endpoint), about $0.042 per 1M input tokens, output free, ~70 to 500 ms per call. Venn accepts Jev's request format. One third-party benchmark (Amplitude, 2026-09-28) found full recall but 55.8% precision on its task. Jev returns probabilities, not rankings from user feedback, so at most it could replace the stage-1 title/company gate after testing on our own labels. Still a per-user, per-job call, so it does not make scoring the whole catalog per user cheap. Andrew: "We can still use Jev through OpenRouter the way Venn does." Venn accepts Jev's request format, so a Jev call through OpenRouter and a local Venn head can sit behind one interface and be swapped.
- **The shape of the idea:**

```
structured SQL filters (location, arrangement, pay floor, seniority, exclusions)
  -> pgvector top-K by similarity to the user's résumé + memo embedding
  -> small trained head re-ranks (global model + per-user adjustment from feedback)
  -> LLM full review only for the top N (the existing stage-2 reviewer)
```

Cost comparison (arithmetic, prices from the library check; [Inference] on token counts):

| | Today: LLM-score per job | Proposed |
|---|---|---|
| Per job, per user | ~3k input tokens on DeepSeek V4 Flash ≈ $0.0005 | Similarity plus head: CPU only, effectively $0 |
| Whole catalog for one user | ~835k × $0.0005 ≈ $400, so today it is capped at 400 jobs/day after a location prefilter | Retrieval over the whole catalog every time; LLM review only for top N (e.g. 50/day ≈ $0.025) |
| Shared one-time cost | none | Embed the catalog once: ~$10 at ~600 tokens/job, ~$33 at ~2k tokens, on OpenAI `text-embedding-3-small` ($0.02/M) or `voyage-4-lite` ($0.02/M, 200M free tokens). New postings embedded at ingest |
| Storage | none | ~835k vectors: ~1.7 GB at 1024-d `halfvec` (3.4 GB as `vector`), plus HNSW index overhead [Inference: roughly 50 to 100% more]. Embedding only live jobs inside the discovery window would shrink this |

What it needs:

- pgvector on Supabase: available but not installed on prod; prod DB is 3.6 GB today (coordinator check, 2026-11-19), so the vector index would roughly double it. HNSW is the documented default; filtered queries need pgvector 0.8+ iterative scans, otherwise a selective WHERE can return fewer rows than the LIMIT). Check disk and RAM headroom on the Supabase plan for the index build before starting.
- An embedding step at ingest in the Python discovery pipeline, a backfill job for existing postings, and a profile embedding refreshed on résumé or memo change.
- A head trained in Python (scikit-learn logistic for shortlist vs skip, ridge for a score) on the reviewer side, using shortlist, skip-with-reason, applied and later outcomes as labels. Skip reasons become structured features. A global head with a shrunk per-user offset, because per-user labels are tiny.
- Cold start: a new user has no labels, so rank by similarity alone (inside the filters) and blend the head in as feedback accumulates.
- Hard constraints stay in SQL. Similarity is weak at pay, location, seniority and visa, which is why the filters come first.

This changes the reviewer's candidate selection (today: location prefilter, then score what fits under the cap) and would replace the scoped re-review in builder's call 16: a memo change re-embeds the profile and re-ranks instantly, and only the new top N need an LLM review. It also makes the teach-by-talking loop (G3) visible immediately instead of after a re-review trickle.

---

## 14. Builder's calls to check

These are choices I made that Andrew did not hear in the brainstorm. They stand unless he objects.

1. Agent loop and tools in TypeScript on Vercel; reviewer stays Python and is driven by `review_requests`.
2. A turn splits into gather and present, with "re-render as" for comparison.
3. The analytics viz kit, sizes and metric list in section 6.6.
4. Variant 3 ships to everyone on a `srcdoc` sandbox; the separate origin is required before real users (phase 5).
5. Unattended runs are propose-only and cannot generate documents.
6. Vercel Cron for the schedule; one review and digest per active user per day.
7. Inbox items are fixed cards, not variant-rendered.
8. Memo is compiled into `profiles.instructions`; re-review after a memo change is scoped (see 16).
9. Tracker stages as listed.
10. Model pickers and `/profile/advanced` are removed now, ahead of the cost model rework.
11. `/companies` leaves user navigation; the logged-out `/board` stays.
12. Dictation through a server route and a non-OpenRouter speech provider; no Web Speech API path.
13. The "catalog clock" helper for frozen data.
14. Multiple threads, with background findings kept out of threads.
15. No columns dropped; retired columns are left in place.
16. **Scoped re-review is required, not optional.** A full re-review is not a real fallback: changing `profile_version` makes every reviewed job eligible again under the same per-user daily cap (400 on Standard, `lib/entitlements.ts`), so "what moved" would trickle in over days while competing with new jobs. Scope: the user's shortlist (all states except skipped) plus the newest reviewed jobs up to a cap set in the plan. This replaces the earlier open question on re-scoring.
17. **Until phase 4, "suggested" is filled deterministically.** After a review finishes, the top approved jobs by fit (not already triaged) become `suggested`, with the two-line brief taken from the review's existing reasoning and red flags, no extra LLM call. The handoff is a check on page load and on the review-progress poll, not a queue. Agent-written briefs and the inbox arrive in phase 4. "Scenario (a) passes in phase 1" means picks land in the shortlist; the "result lands in the inbox" step is phase 4.
18. **Testers use seeded persona accounts.** Two or three personas with pre-reviewed jobs, comped plans and synthetic résumés. This avoids invites, slow per-tester reviews and real personal data in Langfuse traces (which account deletion does not remove today). The cost: testers judge a résumé that is not theirs. If Andrew wants testers on their own data, phase 2 needs per-tester invites, plan overrides and Langfuse redaction first.
19. **Variants are temporary.** It is an experiment. Variants 2 and 3 are built to prototype quality (validators and the security controls in full, but no UI-contract polish beyond what the evals need). After the decision, the losers, the switcher and "re-render as" are deleted in phase 3, and the winner is hardened. Keeping user-selectable freedom levels as a feature would be a new decision.
20. **One model for the demos; the scripted matrix runs twice** (cheap default, then a stronger model), because scripted runs are cheap and this separates "freedom breaks" from "model too weak". Candidate default: Claude Haiku 5.5 through OpenRouter ($0.10/$0.50 per MTok up to 100K prompt tokens, $0.50/$2.50 above, per Anthropic's pricing page in the library check).
21. **Daily cadence on Vercel Cron.** One tick per day covers one review and digest per active user, which should fit any Vercel plan [Unverified: plan not readable from the Vercel connector]. If it does not, the fallback is a small enqueue-only loop in the Railway worker, with agent runs still executed by a Vercel route.

---

## 15. Open questions for Andrew

None open as of 2026-11-20. Answered on 2026-11-19 and 2026-11-20: outside jobs (removed, catalog only); variant 3 access (all three ship to everyone); search scope (reviewed jobs only, search upgrade parked); analytics freedom (agent-built from a fixed kit, section 6.6); judging the experiment (Andrew decides after demos, section 7.3); background pre-drafting (future work); zod (allowed, section 3).

Before the plan, Andrew may want to skim the builder's calls in section 14, which he has not explicitly approved.
