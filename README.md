# Shipyard

Shipyard is a Claude Code plugin that ships a large coding job — a big feature, refactor, rewrite or migration —
as a chain of small, independently mergeable slices. Every slice gets a test plan before any code, is built and
verified by specialist agents, and is reviewed by the right reviewers before you see it. You approve the plan and
every merge; slices merge locally into a feature branch you name, and you raise the pull request to `main`
yourself.

```mermaid
flowchart LR
    req["Your request"] --> p0["P0 Intake: you set limits and the branch"]
    p0 --> disc["Discover: scan, brainstorm, draft"]
    disc --> p4["P4 Questions: you pick a direction"]
    p4 --> plan["Plan: critique, refine, cut slices"]
    plan --> p8["P8 Plan approval: you approve"]
    p8 --> loop["Slice loop × N: test plan, build, verify, review"]
    loop --> gate["Merge gate: you approve each slice"]
    gate --> merge["Local merge into the feature branch"]
    merge -->|"more slices"| loop
    merge -->|"all slices merged"| pr["You push and raise the PR to main"]
    classDef human fill:#fde68a,stroke:#b45309,color:#000000
    class p0,p4,p8,gate,pr human
```

<sub>Yellow boxes are yours. Source: [docs/diagrams/01-hero.mmd](docs/diagrams/01-hero.mmd).</sub>

## Why it is safe

- **Test plan first.** No production code and no test code until the slice's `TEST_PLAN.md` is approved by the
  code reviewer. Hooks enforce it for editor writes and for the shell writes they can see (redirects, `tee`,
  `sed -i`, `cp`, `rm`); see [guardrails](docs/guardrails.md) for what they cannot see.
- **Order is code, not hope.** Three saved workflows (`/shipyard:discover`, `/shipyard:plan`, `/shipyard:slice`)
  enforce phase order, loop caps, reviewer routing, deduplication and structured returns.
- **Eight hooks** guard the rules that matter most: protect-branches, write-scope, test-plan-gate, readonly-bash,
  goldfish-blinders, secrets-guard, findings-gate and brief-check. They do nothing outside Shipyard sessions.
- **One slice at a time.** Slices run one after another on purpose: with a single active slice, the hooks know
  exactly which files each agent may touch. Inside a slice, the implementer and verifier work in parallel and the
  reviewers run concurrently.
- **It never touches `main`.** Work happens on slice branches merged into your feature branch. Shipyard never
  pushes, and never commits, merges, rebases or resets on a protected branch.
- **You approve every merge.** Agent approval is not merge approval. `MERGED` happens only after you say so.
- **Your history stays clean.** Shipyard's working notes live in `.ai/`, which never enters your feature branch or
  pull request (it is ignored through `.git/info/exclude`, so your project's `.gitignore` is not touched). They are
  committed instead to a separate notes branch, `<feature>-shipyard`, at every checkpoint, so nothing is lost and a
  fresh clone can resume. Each merge commit also carries a short evidence summary.

## Quickstart

1. **Install.** Pick one:

   **From the marketplace** (inside Claude Code):

   ```text
   /plugin marketplace add vineethvarghese/shipyard
   /plugin install shipyard@shipyard
   ```

   **Without a marketplace** — point Claude Code straight at a local clone:

   ```bash
   git clone https://github.com/vineethvarghese/shipyard.git
   claude --plugin-dir ./shipyard
   ```

2. **Set up** — run the guided setup in your project folder:

   ```text
   /shipyard:setup
   ```

   It checks your environment, merges Shipyard's permission rules into `.claude/settings.json` without touching
   your own, and asks for your test command — so you aren't prompted on every step. Answer a couple of questions
   and you're done. (Prefer to do it by hand? Merge [`settings.example.json`](settings.example.json) yourself.)

3. **Launch** the coordinator as the main session, in your project folder:

   ```bash
   claude --agent shipyard:coordinator --model opus --effort max
   ```

4. Describe the job in plain words. The coordinator does the rest and stops when it needs you.

Full walkthrough: [docs/getting-started.md](docs/getting-started.md).

## The four human stops

| Stop | When | You decide |
|---|---|---|
| **P0 Intake** | Right after your request | Delivery limits C-1..C-9, the feature branch and base branch, brainstorm breadth. Skipped items take a marked default. |
| **P4 Questions** | After the repo scan and brainstorm | Which concept to build, and the gaps that change the plan. |
| **P8 Plan approval** | After critique and slicing | Approve `PLAN.HUMAN.md`, or ask for changes. |
| **Merge approval** | After each slice is clean | Merge the slice into the feature branch, or request changes (`REVIEW.HUMAN.md`). |

Shipyard may also stop for a shared validation environment, an escalation after capped loops, or a fail-closed
block — always with a one-line reason and a recommendation.

## The agents

| Agent | One line |
|---|---|
| `coordinator` | The only entry point: runs phases, gates, state, branches, merges and human briefs. |
| `discovery` | Scans the repo, synthesises the brainstorm, drafts artifacts and the gap list. |
| `goldfish` | Context-free thinker: one brainstorm lens, or a cold readiness read of a slice spec. |
| `architect` | Architecture, invariants, plan critique, dispute adjudication, post-merge revalidation. |
| `planner` | Cuts the work into vertical slices with touch sets, order and branches. |
| `implementer` | Writes production code for one approved slice. Never tests. |
| `verifier` | The slice's test engineer: test plan, tests, verification and routing facts. Never production code. |
| `code-reviewer` | Gates the test plan; reviews code and tests together for clarity, depth, performance and test quality. |
| `security-reviewer` | Finds vulnerabilities with concrete attack paths. |
| `contract-reviewer` | Public API, DTOs, serialization, errors and compatibility. |
| `integration-reviewer` | Consumers, onboarding, migration, rollout and rollback. |
| `reliability-reviewer` | Failure, concurrency, cancellation, lifecycle and resource bounds. |
| `simplicity-reviewer` | Asks whether each new layer or abstraction should exist at all. |

Per-agent pages (generated): [docs/agents/README.md](docs/agents/README.md).

## Repo map

```text
.claude-plugin/     plugin.json and marketplace.json
agents/             13 agent shells (identity, jurisdiction, inputs, constraints, return contract)
commands/           setup.md — the /shipyard:setup guided install
skills/             shipyard-framework (shared contract) + one capability skill per ability
registry/roles.json role → agent, compute per mode, routing triggers, contract
contracts/          JSON Schemas for every agent return block and .ai/state.json
workflows/          discover.js, plan.js, slice.js — the saved workflows
hooks/              hooks.json, hook scripts and their tests
scripts/            state helper, contract validator, repo checks, settings installer, doc generator, link checker
tests/              workflow tests (node --test) and script tests (unittest)
evals/              plugin evals for the workflow and each ability
docs/               guides, ADRs, diagrams and generated agent pages
examples/           a tiny sample project with an illustrative .ai/ folder
```

## Requirements

- Claude Code 2.1.300 or later.
- Dynamic workflows turned on: the "Dynamic workflows" row in `/config`, and no `"disableWorkflows": true` in your
  settings.
- git, and a git repository to work in.
- Python 3.9 or later (standard library only) for the hooks and scripts.
- Node 22 only to run this repo's own workflow tests.

## Documentation

- [Getting started](docs/getting-started.md) · [Concepts](docs/concepts.md) · [Workflow P0–P10](docs/workflow.md)
- [The slice loop](docs/slice-loop.md) · [Architecture](docs/architecture.md) · [Brainstorm](docs/brainstorm.md)
- [Branching](docs/branching.md) · [Guardrails](docs/guardrails.md) · [Extending](docs/extending.md)
- [Evals](docs/evals.md) · [Troubleshooting](docs/troubleshooting.md) · [Decisions (ADRs)](docs/decisions/)
- [Sample project](examples/sample-project/README.md) · [Migration from the earlier framework](MIGRATION.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

## Credits

Shipyard's brainstorm builds on the elephant/goldfish method
([elephant-goldfish](https://github.com/vshvedov/elephant-goldfish), MIT). The simplicity reviewer's voice is
adapted from the MIT-licensed "Cranky Old Sam" reviewer persona. Ideas from Ousterhout, Gregg and Evans are
paraphrased, never quoted. Full credits: [NOTICE](NOTICE).

## Licence

MIT. See [LICENSE](LICENSE).
