# ADR-0007: Keep `.ai/` off the work branches; commit it to a notes branch

- Status: Accepted
- Date: 2026-10-16

## Context

Shipyard keeps its working state in `.ai/`: plans, slice specs, test plans, evidence, briefs and `state.json`. The
first design committed most of `.ai/` on each slice branch, in its own commit. That put Shipyard's notes into the
human's feature branch and pull request, and it needed a `.gitignore` change in the human's project for the files
that had to stay out. The human wants their work to contain only their code and tests, and they also want the notes
kept safely in git, so that nothing is lost and a fresh clone can resume.

## Options considered

1. **Commit `.ai/` on the slice branches** (the first design). History in git, but the notes travel into the
   pull request.
2. **Ignore `.ai/` and never commit it** (`.git/info/exclude` only). Clean work branches, but the notes exist on one
   machine only: a fresh clone cannot resume, and deleting the folder loses them.
3. **Ignore `.ai/` on the work branches and commit it to a separate notes branch.** Clean work branches and a full
   history of the notes in git.

## Decision

Use option 3.

- At P0, `shipyard_state.py init` runs `ignore-ai`: it adds `/.ai/` to `.git/info/exclude` (git's per-machine ignore
  list, so the project's `.gitignore` is untouched), then checks that git ignores `.ai/` and tracks nothing in it. It
  refuses if `.ai/` files are already tracked; the human decides whether to untrack them. It records the notes
  branch, `<feature>-shipyard` by default.
- At every checkpoint (each phase transition, slice write-up, merge, reconciliation and completion) the coordinator
  runs `shipyard_state.py snapshot`. It commits the whole `.ai/` folder to the notes branch with git plumbing: a
  private index, `write-tree`, `commit-tree` and a checked `update-ref`. It never checks anything out and never
  touches the working tree, the index or the current branch. An unchanged folder makes no commit.
- `shipyard_state.py restore --from <notes branch>` writes `.ai/` back into a clone that has none.
- The coordinator never runs `git commit`: its git writes are branches, the `--no-ff` merge, a revert on the human's
  yes, and snapshots. protect-branches refuses a coordinator `git commit`, any `git add` of a `.ai` path, any forced
  add, and any checkout, reset, move, delete, merge or worktree of the notes branch. write-scope keeps the
  coordinator out of the project's `.gitignore`.

## Consequences

- The feature branch, the slice branches and the pull request contain only code and tests. The merge check is
  exact: the slice tip must be the evidence commit.
- Ignored files are not tracked, so `.ai/` stays in the working tree across branch switches with no handling.
- The notes keep their full history, one commit per checkpoint. Work done after the last snapshot is the only thing
  a lost folder costs.
- The notes branch is local like everything else Shipyard does. The human pushes it if they want an off-machine copy.
- Each merge commit message also carries a short evidence summary, so the feature branch's history explains each
  merge on its own.
- Secrets are still kept out of `.ai/` (secrets-guard): the notes branch may be pushed, and briefs quote `.ai/`.
