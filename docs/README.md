# Shipyard documentation

Shipyard is a Claude Code plugin for big coding jobs. It takes a large feature, refactor, rewrite or migration
and ships it as a series of small slices. Each slice gets a test plan before any code. Each slice is built,
verified and reviewed by specialist agents. You approve the plan and every merge. Slices merge locally into a
feature branch you name. Shipyard never touches `main` and never pushes. When the work is done, you push the
feature branch and raise the pull request yourself.

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

<sub>Source: [01-hero.mmd](diagrams/01-hero.mmd) · rendered: [01-hero.svg](diagrams/01-hero.svg)</sub>

## Is it for you?

| Use Shipyard when | Use a normal session when |
|---|---|
| The change spans many files or several weeks of work | The change is small and the design is clear |
| You want reviewable steps with evidence | You only want a quick answer or one-off fix |
| You want a test plan before code, every time | Tests are already obvious or not needed |
| You want to approve each step before it lands | You are happy to review one big diff at the end |

## Reading order

New to Shipyard? Read the first four pages in order. Read the rest when you need them.

| # | Page | What it covers |
|---|---|---|
| 1 | [getting-started.md](getting-started.md) | Install, first run, the four times Shipyard stops for you |
| 2 | [concepts.md](concepts.md) | Slices, gates, evidence, findings, roles, the `.ai/` folder |
| 3 | [workflow.md](workflow.md) | The phases P0 to P10 |
| 4 | [slice-loop.md](slice-loop.md) | What happens inside one slice |
| 5 | [architecture.md](architecture.md) | The four layers and who may call whom |
| 6 | [brainstorm.md](brainstorm.md) | The elephant/goldfish brainstorm and readiness checks |
| 7 | [branching.md](branching.md) | Branches, commits, the merge procedure |
| 8 | [guardrails.md](guardrails.md) | The eight hooks and what they block |
| 9 | [extending.md](extending.md) | Add a reviewer, an ability or a language pack |
| 10 | [evals.md](evals.md) | Ability evals, process evals and deterministic tests |
| 11 | [troubleshooting.md](troubleshooting.md) | Common problems and fixes |
| — | [agents/](agents/) | One page per agent, generated from the agent files and the registry |
| — | [decisions/](decisions/) | Architecture decision records ADR-0001 to ADR-0007 |
| — | [diagrams/](diagrams/) | Mermaid sources (`.mmd`) and rendered `.svg` files |

## Decisions

| ADR | Decision |
|---|---|
| [ADR-0001](decisions/ADR-0001-saved-workflows.md) | Order, caps and fail-closed live in saved workflows, not in judgment |
| [ADR-0002](decisions/ADR-0002-test-plan-first.md) | Every slice gets an approved test plan before code or tests |
| [ADR-0003](decisions/ADR-0003-local-merge-never-main.md) | Merge slices locally into a feature branch; never touch `main`; never push |
| [ADR-0004](decisions/ADR-0004-roles-not-agent-names.md) | Workflows name roles; a registry maps roles to agents |
| [ADR-0005](decisions/ADR-0005-code-and-simplicity-reviewers-split.md) | Code review and simplicity review are separate agents |
| [ADR-0006](decisions/ADR-0006-hooks-over-prompt-rules.md) | Hard rules are enforced by hooks, not only by prompts |
