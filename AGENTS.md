# Repository conventions

(Dashboard-specific guidance lives in `dashboard/CLAUDE.md`.)

## Git

- **Never rewrite existing commits.** Do not `git commit --amend`, `git rebase`
  (interactive or not), `git reset` a branch that has commits others may have
  seen, force-push, or otherwise change a commit that already exists. Always add
  a **new commit on top** instead — even for a one-line correction.

  Rewriting changes the commit SHA, which silently invalidates anything that has
  already read, reviewed, verified, or **pinned** the old SHA — another agent, a
  migration rehearsal pinned to a commit, an in-flight review — and leaves the
  branch's state ambiguous (two SHAs that look "done"). If an earlier commit
  needs fixing, reconcile by **committing forward**, not by amending.

- This applies to delegated work too. If you dispatch a subagent, hold it to the
  same rule: "reconcile by amending" is not allowed; reconcile with a follow-up
  commit. When a base commit is superseded, say so explicitly and re-pin any
  dependent work (rehearsals, reviews) to the new SHA.
