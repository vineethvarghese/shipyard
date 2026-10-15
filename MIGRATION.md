# Migration: from the earlier CLI framework to Shipyard on Claude Code

Shipyard is a port of an earlier multi-agent delivery framework written for another agent CLI: a shared
`delivery-framework` skill plus ten `delivery-*` agents. The core design carried over — slices, human gates,
jurisdiction-routed review, findings with evidence, the `.ai/` state folder. This page maps the old concepts to
the new ones and explains what changed and why.

If you have a project half-way through the old framework, see [Moving a running project](#moving-a-running-project).

## Concept mapping

| Old (earlier CLI framework) | New (Shipyard on Claude Code) | Notes |
|---|---|---|
| `agents/<name>/AGENTS.md`, one folder per agent | `agents/<name>.md`, flat files, invoked as `shipyard:<name>` | Plugin agents are namespaced. Subfolders would become part of the name. |
| `delivery-*` agent names | Role names in `registry/roles.json` mapped to `shipyard:*` agents | Workflows know roles, not agent names ([ADR-0004](docs/decisions/ADR-0004-roles-not-agent-names.md)). |
| Sidecar `WORKFLOW.md` next to the coordinator | `skills/shipyard-framework/references/coordinator-workflow.md`, read just in time | The coordinator loads only the phase it is about to run. |
| `delivery-framework` skill | `shipyard-framework` skill (shared contract) + one capability skill per ability | Expertise moved out of agent files into versioned skills with their own evals. |
| `task` tool delegation, one call at a time | Three saved workflows (`/shipyard:discover`, `/shipyard:plan`, `/shipyard:slice`) + the `Agent` tool for direct calls between workflows | Order, caps, routing and dedupe are now code ([ADR-0001](docs/decisions/ADR-0001-saved-workflows.md)). |
| `mode="background"` for parallel reviewers | `parallel(...)` inside the slice workflow | Reviewers still run independently and concurrently. |
| Model, effort and context tier passed on every `task` call (frontmatter `model:` ignored) | `model` and `effort` in agent frontmatter as the role default; workflows override per mode with `agent({model, effort})` from the registry's compute classes | The coordinator runs at `--model opus --effort max`; a delegate never gets more. |
| Built-in `security-review` agent, normalised into the finding schema | `shipyard:security-reviewer` agent + `security-audit` skill | A first-class reviewer with its own contract, routing and evals. |
| `Caller: delivery-coordinator` line + `user-invocable: false` | The coordinator's `Agent(...)` allowlist + specialists without the `Agent` tool + the `brief-check` hook | The caller line stays as a routing header (`Caller: shipyard:coordinator`), not a security control. |
| Rules written only in prompts | Eight hooks in `hooks/hooks.json` | protect-branches, write-scope, test-plan-gate, readonly-bash, goldfish-blinders, secrets-guard, findings-gate, brief-check ([ADR-0006](docs/decisions/ADR-0006-hooks-over-prompt-rules.md)). |
| Free-text return blocks | JSON Schema contracts in `contracts/`, enforced by the workflow runtime or `scripts/shipyard_validate.py` | Contracts carry `x-contract-version`; a major bump is breaking. |
| `PROJECT.md` status line only | `PROJECT.md` + machine-readable `.ai/state.json` written via `scripts/shipyard_state.py` | Hooks and resume read `state.json`. |
| Human merges a PR per slice | Coordinator merges each approved slice locally (`--no-ff`) into your feature branch; you raise one PR to `main` | [ADR-0003](docs/decisions/ADR-0003-local-merge-never-main.md). |
| Phases P0–P9 | Phases P0–P10 | A brainstorm phase (P2) was added; numbering shifted. |

### Phase mapping

| Old | New |
|---|---|
| P0 Intake | P0 Intake (now a marked gate, with C-8 branches, C-9 cost budget and brainstorm breadth) |
| P1 Discovery | P1 Scan |
| — | P2 Brainstorm and narrow (elephant/goldfish) |
| P2 Draft | P3 Draft |
| P3 Grilling | P4 Questions (gate) |
| P4 Plan critique | P5 Plan critique |
| P5 Refine | P6 Refine |
| P6 Delivery planning | P7 Delivery planning (+ readiness goldfish per slice) |
| P7 Plan approval | P8 Plan approval (gate) |
| P8 Slice | P9 Slice, then P9.9 Merge (gate) |
| P9 Reconcile | P10 Reconcile |

## What changed and why

### Test plan first

The verifier now writes `.ai/slices/<id>/TEST_PLAN.md` before anyone writes code. It maps every acceptance
criterion to planned tests, levels, failure cases, benchmarks for performance criteria and validation tiers.
The code-reviewer reviews it and is the only agent that may flip `Status: DRAFT` to `Status: APPROVED`. The
test-plan-gate hook blocks code and test writes until then. Why: the old design had no one deciding what
"proven" means before the code existed, so evidence was shaped by the implementation
([ADR-0002](docs/decisions/ADR-0002-test-plan-first.md)).

### The verifier is the test engineer

The verifier writes the tests (WRITE_TESTS) in parallel with the implementer writing code (IMPLEMENT). Both
work from `SLICE.md` and the approved test plan, never from each other. Separate touch sets keep their files
apart. The verifier then runs everything (VERIFY) and reports `routingFacts` that decide which reviewers run.

### A code-reviewer that reviews tests too

The new `code-reviewer` reviews code and tests as a pair: clarity, design depth, performance, domain fit and
test quality. It is routed for any production code. Why: nobody reviewed the tests before (R2 below).

### A security reviewer of our own

`security-reviewer` replaces the host's built-in review. It has a contract, routing triggers, a capability skill
and evals like every other reviewer, and its severities map onto ours (CRITICAL/HIGH → BLOCKING, MEDIUM → MAJOR,
LOW → MINOR, INFORMATIONAL → NOTE).

### Elephant/goldfish brainstorm

P2 is new. Discovery writes a sealed "elephant" take first. Then context-free goldfish agents, each with one
lens (technical, value, experience, contrarian, market), propose concepts from only the verbatim request and the
repository. Discovery synthesises, ranks against the delivery limits, flags where goldfish and elephant disagree,
and writes a gap list. At P7 a readiness goldfish reads each `SLICE.md` cold. Why: a planning run anchored on its
first idea and never saw the smaller option.

### Branch policy

You name a feature branch at P0. The coordinator refuses `main`, `master`, the default branch and any protected
branch. Each slice gets `<feature>-slice-<id>`. Approved slices merge locally with `--no-ff`. Nothing is ever
pushed. You push the feature branch and raise the PR. The protect-branches hook enforces it.

### Fix scope

`BLOCKING`, `MAJOR` **and `MINOR`** findings must be fixed or formally rebutted before a slice reaches you.
`NOTE` stays optional. Every finding names an `owner` (implementer for code, verifier for tests) and a `status`.
Each finding may be rebutted once, with a citation; the reviewer answers `ACCEPT_REBUTTAL` or `MAINTAIN_FINDING`.

### Registry, contracts and abilities

The old framework mixed workflow, identity and expertise in long agent files. Shipyard splits them into four
layers: workflows (know roles), the role registry (role → agent, compute per mode, routing, contract), short
agent shells, and capability skills (expertise, versioned, with evals). Contracts sit between workflows and
agents. Why: each layer can now change without touching the others, and each ability can be measured.

## Original recommendations and how Shipyard addresses them

An assessment of the old framework listed nine design risks (R1–R9) and six inconsistencies (I1–I6).

| ID | Problem in the old framework | Fix in Shipyard |
|---|---|---|
| R1 | "Read-only" was prompt text only; reviewers held edit and execute tools, and some builds write files. | The readonly-bash hook blocks mutating commands for reviewers, architect, planner, discovery and goldfish. write-scope limits each reviewer to its own findings file. |
| R2 | No one reviewed the tests. | Test plan first, approved by the code-reviewer; the code-reviewer reviews code and tests together; `test-quality` and `test-design` abilities. |
| R3 | No branch or PR mechanics. | Named feature branch, slice branches, commit message formats, local `--no-ff` merge by the coordinator, the human raises one PR. |
| R4 | Strictly serial slices. | Still serial by default, on purpose: one active slice keeps the hooks' touch-set checks exact. Inside a slice, the implementer and verifier now work in parallel and reviewers run concurrently. |
| R5 | Cost: many deep reviewers per slice, re-run often. | C-9 cost budget at P0; routing in code runs only triggered reviewers; RECHECK re-runs only reviewers with open findings or new triggers; compute classes per mode in the registry. |
| R6 | `.ai/` in the PR diff; findings files public. | `.ai/` never enters the work branches or the PR. P0 adds `/.ai/` to `.git/info/exclude` (git's per-machine ignore list, so the project's `.gitignore` is untouched), and a hook refuses any `git add` of `.ai/`. The coordinator commits `.ai/` to a separate notes branch (`<feature>-shipyard`) at every checkpoint, so the notes keep their history. |
| R7 | Time boxes and the 60-second rule were hard to apply. | Briefs carry `Budget: <n> turns`; agents have `maxTurns`. The verification rule now allows a slower command when it is the narrowest one that settles the question, with its duration recorded. |
| R8 | Tied to one CLI's tools and frontmatter. | This port. The mapping table above is the portability layer. |
| R9 | The caller line could be faked. | Described as routing only. Real enforcement: the coordinator's `Agent(...)` allowlist, specialists without the `Agent` tool, and the brief-check hook. |
| I1 | `HUMAN_REVIEW` was never set. | Set when the merge brief is shown; `MERGED` only after the merge succeeds. |
| I2 | Some `PROJECT.md` statuses were never set; no step recorded `BLOCKED`. | Status changes only between workflows, so `BRAINSTORMING` and `DELIVERY_PLANNING` are now phase-log labels, not status values the coordinator sets (the state schema still accepts them for compatibility). `BLOCKED` is set, with a reason, on every fail-closed stop. |
| I3 | The architect had two verdict vocabularies. | One contract (`architect-result`) with verdicts per mode, including `VALID / UPDATE / ARCHITECTURE_DECISION` for revalidation. |
| I4 | Unclear whether human change requests count toward the 3-round cap. | They do not. Each one still re-runs verification and review in full. |
| I5 | P0 shown as no gate in one place and a gate in another. | P0 is one of the four human stops everywhere. |
| I6 | "Two writers with disjoint files" was not true for `PROJECT.md`. | Write permissions are a table enforced per file by write-scope. `PROJECT.md` still has two writers: the coordinator owns its status and phase log, discovery drafts the other sections. That split is a documented convention; the hook does not police sections inside the file. |

## Moving a running project

The `.ai/` folder format is close enough to continue by hand:

1. Finish or merge any slice that is in flight under the old framework.
2. Install Shipyard and copy `settings.example.json` into `.claude/settings.json`.
3. If the old framework committed `.ai/`, stop tracking it (your decision; it is a change to your repo):
   `git rm -r --cached .ai` and commit that. The files stay on disk.
4. Create a feature branch from your base branch, then run
   `python3 <plugin-root>/scripts/shipyard_state.py init --project <name> --feature-branch <branch> --base-branch main`.
   It adds `/.ai/` to `.git/info/exclude` (so `.ai/` stays off your work branches) and records the notes branch;
   then run `shipyard_state.py snapshot -m "migrated"` to put the existing notes on it.
5. In each remaining `SLICE.md`, split `## Expected touch set` into `## Expected touch set — code` and
   `## Expected touch set — tests`, and add `## Branch`.
6. Set the status with `shipyard_state.py set-status AWAITING_PLAN_APPROVAL` and launch
   `claude --agent shipyard:coordinator --model opus --effort max`. Re-approve the plan at P8. Each remaining
   slice will get a test plan first.
