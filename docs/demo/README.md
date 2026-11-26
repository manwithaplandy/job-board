# Variant demo script

How to run the variant demos on prod (plan Task 2.14, gates A7 and A8). The three
résumés in [`personas/`](personas/) are synthetic: example.test addresses, fictional
towns and companies. Regenerate them with `npm --prefix dashboard run demo:personas`
after changing `dashboard/lib/agent/evals/personas.ts`; a test fails while they are stale.
Do not demo a variant that fails the injection set until it is fixed.

## The personas

- `senior-backend.pdf`, Avery Example: nine years of backend work (Go, payments, Kafka); wants a senior or staff backend role.
- `career-switcher.pdf`, Jordan Placeholder: former science teacher with a year of analytics; wants a junior or mid-level data analyst role.
- `new-grad.pdf`, Sam Sample: new computer science graduate with one internship; wants an entry-level frontend or full-stack role.

## Setup (gate A7), once per persona

1. In `/admin/invites`, generate an invite code (sign-up is invite-only), and check the
   Agent card: Agent on, Variant 3 on, ceilings set.
2. Sign up at `/signup` with the code and an address you can receive mail at (a plus
   address of your own works; the example.test address inside the PDF does not need to
   receive anything), then confirm from the email.
3. In `/admin/tenants`, find the account, set Plan override to Pro and press Set. The
   agent page shows a no-plan notice until the account has a plan, so do this before step 5.
4. A new account lands on `/onboarding` ("Build my board"), which needs a résumé and at
   least one location. Do it first: until it has created the profile, approving a résumé
   on the agent page fails ("Set up your profile before choosing a résumé."). Upload the
   persona's PDF there and pick locations. The PDFs' preferred towns (Exampleton, Testville, Sampleford,
   Mockport) do not exist, and prod only has real platform-discovered jobs, so pick
   Remote plus a real city of your choice. Change them later at
   `/profile/job-preferences`, "Where you want to work". This starts the first review.
5. On `/agent`, attach the same PDF with "Attach a file" for scenario (a) below.
   Approving it there puts the same résumé back, which is harmless.
6. Let reviews finish: the agent page shows "Review finished. New suggestions are on your
   shortlist." and suggestions appear on `/shortlist`.
7. For scenario (d), give the account some history: shortlist a few jobs, press "Start
   preparing" to put them in the tracker, then on `/applications` set Stage to Applied for
   most and Interviewing for one, a few days before the demo.

## Switching layouts

The switcher "Layout for this conversation" offers Blocks (variant 1), Layout (variant 2)
and Code (variant 3). A change applies from your next message; views already shown keep
the layout that made them. "Use for new conversations" makes the current one the default,
which a new conversation (including one started by Compare) starts with.

Under each view, "Re-render as" redraws that view in another layout from the same data,
with no tool calls, and shows the results as tabs ("Versions of this view"). It is the
fairest side-by-side and the safe way to compare (a) and (c), whose steps write to the
account; replaying them repeats the writes. A re-render is a model call against the
persona's spending limit.

## The four scenarios

Run (a) first for each persona: it creates the memo that (b), (c) and (d) use.

- **(a) Résumé upload to first shortlist.** Attach the PDF and send "Here is my résumé.
  Please use it and get me set up." Press "Use as résumé" on the card. Send "Remote or my
  preferred cities are fine. I want product-minded teams and a fair salary, no gambling
  or crypto companies." Press Approve on the memo proposal. Send "Thanks. Now find me a
  first shortlist."
- **(b) Compare two jobs.** On `/shortlist`, tick two jobs and press Compare; it opens the
  agent page and sends the comparison. Then send "Remote matters more to me than pay. Can
  you note that in what I'm looking for?" The memo must not change until you approve.
- **(c) Prepare an application.** Send "Please prepare my application for my best-fitting
  job." Press "Prepare" on the card, and look at the checklist, evidence and tailored résumé.
- **(d) Weekly review.** Send "How did my search go over the last few weeks? What should
  I follow up on?"

## What to look for (supporting A8, not a score)

The spec's checklist for every view: did the viewer find the primary action, predict what
a control does, recognize the same task laid out differently the second time, and manage
without asking the agent how to use what it built? Freedom is expected to help most in
(b) and (d), the dense views, and least in (a) and (c), which are step by step. A mixed
outcome (for example Layout by default, Blocks for anything with actions) is a valid answer.

- **Blocks:** the fixed job components. Is it clear and consistent, and is it enough for
  (b) and (d), or does it feel cramped?
- **Layout:** the model arranges primitives. Is the hierarchy better, and does the same
  question come back laid out the same way? A view that fails validation falls back to Blocks.
- **Code:** the model writes the whole view. Check fit scores, pay and titles against
  `/shortlist` (it can misstate them), whether its controls do what they look like, and
  that nothing is written until you press the host's chip under the frame. A frame that
  fails once shows Blocks from then on.

## Afterwards

`npm --prefix dashboard run eval:summary` writes
`docs/superpowers/plans/2026-11-20-variant-summary.md`; the judge's 10% hand-check sample
is `dashboard/lib/agent/evals/recordings/judge/<run>/hand-check.csv`, and the production
signals come from [`agent-variant-signals.sql`](../runbooks/agent-variant-signals.sql).
