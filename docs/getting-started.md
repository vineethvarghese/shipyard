# Getting started

This page takes you from install to your first merged slice.

## Requirements

| Need | Why | Notes |
|---|---|---|
| Claude Code 2.1.300 or later | Plugin agents, skills, hooks and saved workflows | Shipyard was verified on 2.1.300. Check with `claude --version`. |
| Dynamic workflows turned on | Shipyard runs its three saved workflows with the Workflow tool | On by default on paid plans. On Pro, turn them on in `/config`. An admin can turn them off for an organisation. |
| git | Branches, commits and local merges | Your project must be a git repository. |
| Python 3.9 or later | The hooks and the helper scripts | Standard library only. Nothing to install. |
| Node 22 | Only for this repo's own workflow tests | You do not need Node to use Shipyard. |

## Install

From the marketplace:

```text
/plugin marketplace add <owner>/shipyard
/plugin install shipyard@shipyard
```

Replace `<owner>` with the GitHub owner of the Shipyard repo you use.

From a local clone, for trying it out or for development:

```bash
claude --plugin-dir ./shipyard
```

## Allow the routine commands

Shipyard runs many small commands: `git status`, `git diff`, your test command and its own scripts. Without
allow rules you will be asked about each one. The repo ships `settings.example.json` with a safe set of allow
rules. Copy its `permissions.allow` entries into your project's `.claude/settings.json`. Add your own test
command too, for example `Bash(npm test:*)`, `Bash(go test:*)`, `Bash(pytest:*)` or `Bash(cargo test:*)`.

Allow rules only save prompts. The hooks still apply. See [guardrails.md](guardrails.md).

## Launch

Start Claude Code in your project folder with the coordinator as the main session:

```bash
claude --agent shipyard:coordinator --model opus --effort max
```

Then describe the job in plain words. For example: "Replace our hand-rolled cache with a bounded LRU cache and
move every caller to it."

The coordinator is the only agent you talk to. It launches the other agents and the workflows for you.

## Your first project: the four stops

Shipyard stops and waits for you four times. Between stops it works on its own and posts short status lines.

| Stop | When | What you see | What you do |
|---|---|---|---|
| 1. Intake (P0) | Right after your request | One message with the delivery limits C-1 to C-9, the feature branch and base branch, and the brainstorm breadth. Each item has a recommended default. | Answer what you care about. Anything you skip takes the default and is marked `ASSUMED`. Name the feature branch, for example `feature/lru-cache`. |
| 2. Questions (P4) | After the repo scan and brainstorm | The top concepts, where agents disagreed, and only the gaps that change the plan. Each has a recommendation. | Pick a concept. Answer the gaps. |
| 3. Plan approval (P8) | After the plan has been critiqued and cut into slices | `PLAN.HUMAN.md` in chat: one screen with the slices, their order, risks and anything still `ASSUMED`. | Say "approve", or ask for changes. Only an explicit approval moves on. |
| 4. Merge approval (each slice) | After a slice is built, verified and reviewed clean | `REVIEW.HUMAN.md` in chat: recommendation first, up to three things to check, risks, one line of evidence. | Approve the merge, or ask for changes. |

The intake limits are:

| Item | What it sets |
|---|---|
| C-1 | Slice budget: how big one slice may be |
| C-2 | New-project budget: whether new packages or services may be created |
| C-3 | Reuse posture: prefer existing code or allow new building blocks |
| C-4 | Blast radius: what the work may touch |
| C-5 | Tracking artifacts: what records to keep |
| C-6 | Time and artifact budget |
| C-7 | Convention posture: follow repo conventions or improve them |
| C-8 | Feature branch and base branch |
| C-9 | Cost budget |
| Breadth | Brainstorm breadth 0, 1 or 2 (see [brainstorm.md](brainstorm.md)) |

Shipyard may also stop between the four stops, but only when it must:

- **A shared validation tier.** Some checks need a shared environment. Shipyard never runs those on its own.
  It asks you first.
- **An escalation.** A test plan that was not approved after 2 revisions, or findings still open after 3 fix
  rounds. You get the open items, the options and a recommendation.
- **A block.** Something failed and Shipyard stopped safely. You get the reason in one line.

## Resuming after an interruption

All state lives on disk in `.ai/` in your repo. Nothing depends on the chat history.

1. Start the same command again in the same folder:
   `claude --agent shipyard:coordinator --model opus --effort max`.
2. Say "resume" or "continue".
3. The coordinator reads `.ai/state.json` and `.ai/PROJECT.md`. It tells you the phase, the active slice and
   the next action.

If a slice workflow was cut off half way, the coordinator checks the slice branch with `git` and launches the
slice workflow for that slice again. See [troubleshooting.md](troubleshooting.md) if the two state files
disagree.

## Finishing

When every slice is merged into the feature branch, the project status becomes `COMPLETE`. Shipyard reminds
you of your last step:

```bash
git push -u origin feature/lru-cache
```

Then raise a pull request from the feature branch to `main` in your usual tool. Shipyard never pushes and never
opens the pull request. The slice merges make the feature branch history easy to review one slice at a time.

## Next

- [concepts.md](concepts.md) explains the words used above.
- [workflow.md](workflow.md) shows every phase.
