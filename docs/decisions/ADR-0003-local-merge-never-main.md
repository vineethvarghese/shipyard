# ADR-0003: Merge slices locally into a feature branch; never touch main; never push

- Status: Accepted
- Date: 2026-10-15

## Context

Shipyard produces many small, reviewed slices. They have to land somewhere. Pushing or merging into the base branch
would let agents change shared history and trigger shared systems such as CI deploys. A remote pull request per
slice would need credentials and create noise for other people.

## Options considered

1. **Push each slice and open a pull request per slice.** Needs remote credentials. Many PRs for reviewers.
   Agents act on a shared system.
2. **Merge each slice into the base branch locally.** No remote, but the base branch changes without the normal
   review.
3. **Merge each approved slice locally into a feature branch the human names.** The human pushes the feature
   branch and raises one pull request at the end.

## Decision

Use option 3. The coordinator creates the feature branch from the base branch at P0, and a slice branch from the
feature branch tip for each slice. After the human approves a slice, the coordinator checks the evidence matches
the slice head and runs `git merge --no-ff`. No agent pushes. No agent merges, commits, rebases, resets or
cherry-picks on a protected branch. The protect-branches hook enforces this.

## Consequences

- Nothing leaves the machine without the human doing it.
- The base branch is never changed by Shipyard.
- The feature branch history is a list of merge commits, one per reviewed slice.
- The final pull request can be large. Reviewers can read it slice by slice using the merge commits and
  `EVIDENCE.md`.
- CI on the remote runs only when the human pushes. Shipyard runs the canonical tests locally after each merge.
