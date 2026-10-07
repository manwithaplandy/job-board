# Approved development review-scope amendment — 2026-10-07

Andrew explicitly approved continued development at 13:53 UTC:

> Assistant: “Do you want development to continue with those gaps documented, while keeping deployment blocked?”
> Andrew: “Okay then let’s just continue without reviewing those specific things like you suggested”

This instruction supersedes the earlier full independent security review
prerequisite for DEVELOPMENT continuation only. Task 3 implementation at
`a17b6427ea06c60e801836e56114890441166842` may be used as the development
basis: scoped requirements/business review passed, permitted limited source/
configuration review is recorded, and existing test results retain their actual
scopes and chronology. **Task 3 is not fully security-approved.**

The unreviewed independent-review gaps remain explicit: expiry enforcement,
capacity accounting, cross-user isolation and related adversarial probes.
The author addressed earlier findings, but this does not supply the missing
independent security verdict. The platform refusal remains in BLOCKERS.md.
Do not retry, split, disguise, reproduce the refused probes, or substitute
reviewers/models/tools to evade the safeguard.

Tasks 4–13 continue from the preserved source under permitted ordinary tests
and independent requirements/code-quality review. New task reviewers review
their new tasks; they are not replacement security reviewers for refused work.
Review reports must distinguish implemented, tested, independently reviewed
and deliberately unreviewed areas. Existing briefs’ requirements for BOTH
security/requirements approval are superseded by this amendment only where
necessary to permit development. Functional requirements remain unchanged.
No security approval may be inferred from a requirements PASS or passing tests.
The final whole-branch review has the same permitted scope and explicit gaps.

No production writes, deployment, activation, merge, infrastructure/IAM changes,
or unrelated Railway changes are authorized. Flags remain off, retirement
dry-run and archive disabled. No rollout decision is authorized by this
amendment. Preserve complete-history Library checkpoints after verified
requirements/correctness milestones with the reduced scope labelled clearly.

If another safeguard blocks specific work, report its exact error, stop only
that work, and continue independently permitted work. Do not bypass it.
