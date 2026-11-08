# Changelog

All notable changes to Shipyard are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- **P4 grill** ([ADR-0008](docs/decisions/ADR-0008-grill-at-p4.md)): discovery returns a question tree (kind,
  dependsOn, status); the coordinator asks the frontier round by round, discovery `GRILL` recomputes between
  rounds, terms land in a new `.ai/GLOSSARY.md` as they are settled, answers that are hard to reverse, surprising
  and a real trade-off become short-form ADRs, and the gate ends with a shared-understanding checklist.
  Registry limits `grillRounds` (3) and `grillQuestionsPerRound` (7).
- **Discovery `ELEPHANT` mode**: the sealed elephant take runs at DEEP compute, separately from the STANDARD scan.
- **Spec structure**: `PROJECT.md ## User stories`; `SLICE.md ## Seams under test` and `## Prior art`; the readiness
  goldfish checks a seam exists or is precisely specified as planned; `PLAN.HUMAN.md` lists the seams and the properties being relied on.
- **Test discipline**: tests only at declared seams, doubles only at system boundaries, expected values from an
  independent source of truth, glossary-based names; `TEST_PLAN.md` gains `## Seams under test`,
  an `## Invariants exercised` table with a "violating implementation it fails against" column and `## Test doubles`;
  code-reviewer checks 10–12.
- **Formal rigour C-10** ([ADR-0009](docs/decisions/ADR-0009-formal-rigour-tiers.md)): `none` | `invariants` |
  `properties` | `model-checked`. Extended invariant blocks with plain English and state tables; property tests
  reported in `verify-result.formal`; models under `.ai/formal/` with a planted-fault copy, run by the reliability
  reviewer through the new stdlib `scripts/formal_check.py`, traces rendered as step tables.
  New docs page [formal-methods.md](docs/formal-methods.md); plan routing trigger `modelChecked`.
- `shipyard_state.py init --formal-rigour`; `state.formalRigour` (contract 1.2.0); `discovery-result` 1.1.0;
  `verify-result` 2.1.0.

### Changed

- Escalation policy: "ask the whole frontier per round" replaces "never trickle"; the gap-count heuristic applies
  per round, not to the tree.
- Skills: brainstorm-elephant-goldfish 1.1.0, test-design 1.1.0, test-quality 1.1.0, reliability-review 1.1.0,
  domain-design 1.0.1, shipyard-framework 1.1.0.
- The architect's write scope gains `.ai/formal/**`; discovery may not write there.

## 0.1.0 — 2026-10-15

Initial release: a generic, vendor-neutral port of an earlier multi-agent delivery framework to a Claude Code
plugin. See [MIGRATION.md](MIGRATION.md) for the full mapping.

### Added

- **13 agents**: coordinator, discovery, goldfish, architect, planner, implementer, verifier, code-reviewer,
  security-reviewer, contract-reviewer, integration-reviewer, reliability-reviewer, simplicity-reviewer.
- **Three saved workflows** — `/shipyard:discover` (P1–P3), `/shipyard:plan` (P5–P7), `/shipyard:slice` (P9) —
  that enforce phase order, loop caps, reviewer routing, finding dedupe and structured returns in code.
- **Test plan first**: the verifier writes `TEST_PLAN.md`; the code-reviewer approves it before any code or
  test is written.
- **Elephant/goldfish brainstorm** at P2, with breadth 0, 1 or 2, and a cold readiness goldfish per slice at P7.
- **Branch policy**: a named feature branch, one slice branch per slice, local `--no-ff` merges after human
  approval, never a push, never a protected branch.
- **Eight hooks**: protect-branches, write-scope, test-plan-gate, readonly-bash, goldfish-blinders, secrets-guard,
  findings-gate, brief-check.
- **Four layers**: workflows, role registry (`registry/roles.json`), agent shells, capability skills — with
  versioned JSON Schema contracts (`contracts/`) between them.
- **Capability skills**: code-clarity, performance, domain-design, test-quality, test-design, security-audit,
  brainstorm-elephant-goldfish, contract-review, integration-review, reliability-review, simplicity-review,
  lang-packs, plus the shared `shipyard-framework` skill.
- **Scripts**: `shipyard_state.py` (validated, atomic `.ai/state.json`), `shipyard_validate.py` (contract
  validator), `check.py` (repo hygiene), `gen_docs.py` (agent pages), `check_links.py`.
- **Tests and evals**: hook tests, workflow tests with stand-in agents, script tests, plugin evals for the
  workflow and each ability; CI on every push.
- **Docs**: guides, ten Mermaid diagrams, six ADRs, generated agent pages, an illustrative sample project.

### Changed from the earlier framework

- Fix scope widened: `MINOR` findings must now be fixed or rebutted, not only `BLOCKING` and `MAJOR`.
- Every finding names an `owner` (implementer or verifier) and a `status`.
- `HUMAN_REVIEW` and `BLOCKED` are now set; unused statuses were removed.
- The architect has one verdict set per mode, including `VALID | UPDATE | ARCHITECTURE_DECISION` for revalidation.
- Human change requests at merge time no longer count toward the 3-round cap.
- The caller line is described as routing, not security; real enforcement is the agent allowlist and hooks.

### Changed before release: `.ai/` off the work branches, on a notes branch

- `.ai/` never enters the feature or slice branches or the pull request. `shipyard_state.py init` (and the new
  `ignore-ai` command) adds `/.ai/` to `.git/info/exclude`, so the project's `.gitignore` is not touched; it refuses
  if `.ai/` files are already tracked.
- New `shipyard_state.py snapshot`: commits `.ai/` to a notes branch (`<feature>-shipyard`, `state.json` →
  `notesBranch`) with git plumbing, without touching the working tree, index or current branch. The coordinator
  takes a snapshot at every checkpoint. New `restore --from <branch>` brings `.ai/` back in a fresh clone.
- The coordinator no longer runs `git commit` (no `slice <id>: .ai state` commits); its merge commit carries a short
  evidence summary. The merge check is now exact: the slice tip must be the evidence commit.
- protect-branches refuses a coordinator `git commit`, any `git add` of `.ai/`, any forced add, and any checkout,
  reset, move, delete, merge or worktree of the notes branch; write-scope no longer lets the coordinator edit
  `.gitignore`. `state` contract 1.1.0 (optional `notesBranch`).
  [ADR-0007](docs/decisions/ADR-0007-ai-folder-stays-local.md).

### Hardened before release (independent review)

An independent review of the build against the plan found 22 problems that the test suites did not catch. All are
fixed, each with a regression test:

- **Workflow.** Findings from one reviewer at one location are never merged (one had been silently dropped). The
  human's merge-gate change requests have a real path (`humanChanges`), outside the round cap. Author architecture
  concerns and test disputes go to the architect, whose ruling goes back to the right author. Code review always
  runs (test-only slices included) and re-reviews fix-round code. A security-category finding pulls in the security
  reviewer. Rebuttals use their own `REBUTTAL` mode and contract. `sharedApproved` no longer skips the test plan.
  The test plan's approval is confirmed by the code-reviewer and re-read by every VERIFY (fail closed). Authors'
  stubs and unmet ACs block `READY_FOR_HUMAN`. Plan refine cycles count across launches. Discover breadth defaults
  to 1.
- **Hooks.** write-scope and test-plan-gate also police Bash writes. An approved test plan is frozen for the
  verifier. protect-branches also covers `git fetch src:dst`, worktrees on protected branches, branch-changing git
  after `cd`, `reset` on a protected branch and `symbolic-ref`; `git revert` is allowed for the coordinator on the
  feature branch only. New goldfish-blinders hook. findings-gate rejects stale findings files and re-checks up to 3
  times.
- **Contracts.** `verify-result` 2.0.0 (required `testPlanStatus`); `author-result` 1.1.0 (optional
  `testDisputes`); `slice-workflow-result` 1.1.0 (optional `authorNotes`, `humanChanges`); `plan-workflow-result` 1.1.0 (optional
  `cyclesUsed`); `reviewer-result` 1.0.1 (documents `extras.testPlanStatus`); `state` (documents the two
  phase-log-only statuses).
- **Second independent check.** A fresh agent re-verified every fix and found regressions the fixes introduced, also
  fixed with tests: reviewers answering a rebuttal are no longer held by the findings gate; shell writes after `cd`,
  relative writes that leave the project, and writes whose paths the command line hides (`git apply`, `patch`,
  archive extraction, `curl -O`) are refused; `--git-dir`/`--work-tree`/`GIT_DIR` count as a directory change for
  protect-branches; rebuttals survive an architect ruling in the same round; merged findings are rechecked under
  each reviewer's own id; a rebuttal no longer hides a later finding at the same place; architect rulings and
  reported unfinished work get a fix pass and are checked for completion; the plan workflow keeps findings a recheck
  leaves out; goldfish checks are case-insensitive.
