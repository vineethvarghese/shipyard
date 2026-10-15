# Evals and tests

Shipyard has three kinds of checks. Two use real models and cost money. One is deterministic and free.

| Kind | Where | Checks | Uses a model? |
|---|---|---|---|
| Ability evals | `evals/abilities/<ability>/<case>/` | One capability skill does its job: finds the planted bug, rates severity right, stays quiet on clean code | Yes |
| Process evals | `evals/workflow/<case>/` | The process holds: gates are respected, the test plan comes first, nothing is pushed, findings are routed | Yes |
| Deterministic tests | `hooks/tests/`, `tests/scripts/`, `tests/workflows/` | Hook allow and deny rules, helper scripts, workflow order, caps, routing and fail-closed behaviour | No |

## Ability evals

Each case has a `prompt.md` and one or more graders in `graders/`. Graders can match a regex, check a tool was
used, check tool order, check a file exists, or ask a judge model to score against written criteria. Each run starts
in an empty workspace, so the prompt carries the code to review.

Use them when you change an ability. Run the ability's cases before and after, and compare.

## Process evals

Process cases need a real repo to work in. Each has a `case.yaml` with a scaffold script (`setup.sh`) that builds
a small git repo with an `.ai/` folder before the run. They check behaviour such as "refuses to merge without
approval" or "never writes code before the test plan is approved".

## Deterministic tests

| Suite | Command | Needs |
|---|---|---|
| Hooks | `python3 -m unittest discover -s hooks/tests` | Python 3.9+ |
| Helper scripts | `python3 -m unittest discover -s tests/scripts` | Python 3.9+ |
| Workflows | `node --test tests/workflows/` | Node 22 |
| Repo checks | `python3 scripts/check.py` | Python 3.9+ |
| Generated docs | `python3 scripts/gen_docs.py --check` | Python 3.9+ |

The workflow tests load each `workflows/*.js` file and run it with stand-in agents that return scripted results.
They check things like: the 3-round cap ends in `ESCALATE`, an empty reviewer fails closed, routing follows the
facts, the test-plan gate comes before the build, and a shared tier returns `NEEDS_SHARED_APPROVAL`.

## How to run the evals

From the repo root:

```bash
claude plugin eval .                                  # all eval cases
claude plugin eval . --scaffold                       # needed for process cases with a setup script
claude plugin eval . --ablation none                  # skip the comparison runs without the plugin
claude plugin eval . --judge-model sonnet             # use a cheaper model for the judge graders
```

Combine the flags as needed. Results go under `evals/**/results/`, which is gitignored.

## Costs

Every eval run is a real Claude Code session.

- Cost grows with cases × runs per case × the model each case uses.
- Process cases cost the most: they run whole phases with several agents.
- Ability cases are cheaper: one agent, one input.
- `--ablation none` cuts the comparison runs. `--judge-model sonnet` makes judge graders cheaper.
- Run only the group you changed while you work. Run the full set before a release.

The deterministic tests cost nothing and run in seconds.

## In CI

- Run the deterministic tests and the repo checks on every pull request. They are fast, free and stable.
- Do not run the model evals on every pull request. They cost money and their results vary from run to run. Run
  them by hand before a release, or on a schedule if you accept the cost.
- When a change touches an ability, attach that ability's eval results to the pull request.
