# Troubleshooting

Each entry gives the symptom, the likely cause and the fix.

## Workflows are disabled

**Symptom:** the coordinator says it cannot launch `shipyard:discover`, `shipyard:plan` or `shipyard:slice`, or the
Workflow tool is missing.

**Cause:** dynamic workflows are off.

**Fix:** on paid plans they are on by default. On Pro, turn them on in `/config`. If your organisation's admin has
turned them off, ask them to turn them on. Shipyard does not fall back to running the phases by hand, because the
order and caps would then depend on judgment ([ADR-0001](decisions/ADR-0001-saved-workflows.md)).

## A gate seems stuck

**Symptom:** the coordinator keeps waiting, or asks again.

**Cause:** it did not get an explicit answer. "Looks good" or silence is not approval.

**Fix:** answer clearly: "approve the plan", "approve the merge of slice 03", or name the change you want. At P0
and P4 you can say "use the defaults for the rest".

## BLOCKED_REVIEWER

**Symptom:** the slice stops with `BLOCKED_REVIEWER`.

**Cause:** a reviewer returned nothing or invalid output twice. Shipyard fails closed rather than treat a missing
review as clean.

**Fix:**

1. Read the reason in `PROJECT.md`. It names the reviewer.
2. Common causes: the reviewer ran out of turns on a slice that is too big, or a findings file did not parse.
3. Ask the coordinator to re-run the slice. If it blocks again, split the slice.

## A hook blocked something unexpectedly

**Symptom:** an agent reports "blocked by hook" with a reason.

**Fix:** see [guardrails.md](guardrails.md#debugging-a-hook). Usual causes:

| Reason mentions | Check |
|---|---|
| Touch set | The file is not in the slice's `## Expected touch set — code` or `— tests`. Ask the planner to update `SLICE.md`, or move the change to another slice. |
| Test plan | `TEST_PLAN.md` is still `Status: DRAFT`. The test-plan gate has not passed. |
| Protected branch | The current branch is protected. Check `git branch --show-current` and `state.json`. |
| State missing | `.ai/state.json` is missing or invalid. Run `python3 <plugin root>/scripts/shipyard_state.py show`. |
| Secret | The text looks like a secret. Replace the value with `<REDACTED>` and note where the secret lives. |

## Confirm the guardrails are actually running

**Why:** every hook first reads `agent_type` from its input and does nothing unless it starts with `shipyard:`
(so your normal sessions are never touched). The whole safety story therefore depends on Claude Code sending
that prefixed agent type for Shipyard agents. The tests check the scripts and their wiring, but only a live
session proves the runtime sends the prefix. This one-minute check confirms it.

1. Launch the coordinator with hook debug on:

   ```bash
   SHIPYARD_HOOK_DEBUG=1 claude --agent shipyard:coordinator --model opus --effort max
   ```

2. Give it any small task so it runs a command or two, and watch stderr. You want to **not** see this line for
   Shipyard agents:

   ```text
   [shipyard-hook:protect-branches] agent_type '...' is not a Shipyard agent; allowing
   ```

   If every hook prints that for the coordinator and its specialists, the agent type is not arriving as
   `shipyard:<name>`, so the guardrails are inert. Check that you launched with `--agent shipyard:coordinator`
   (not a renamed copy) and that the plugin is enabled in `/plugin`. A hook that recognises a Shipyard agent
   stays quiet unless it blocks, or prints its own `[shipyard-hook:...]` reasoning.

## Resume after an interruption

Start the coordinator again in the same folder and say "resume". See
[getting-started.md](getting-started.md#resuming-after-an-interruption).

If the coordinator says `state.json` and `PROJECT.md` disagree, it reconciles them from the artifacts and `git`
before doing anything. If it cannot, it stops as `BLOCKED` and tells you which fact differs. Check
`git branch --show-current` and `git log --oneline -5` and tell it which is right.

If you were on a slice branch with uncommitted changes, the coordinator will not merge. Let it re-run the slice,
or commit or discard the changes yourself.

## Merge conflict

**Symptom:** "Merge of slice 04 aborted: conflict in src/cache/store.ts".

**Cause:** the feature branch moved after the slice branch was cut. This usually means you edited the feature
branch by hand, or a slice was merged out of order.

**Fix:** nothing was half-merged; the coordinator ran `git merge --abort`. Choose one:

- Ask the coordinator to re-cut the slice from the current feature branch tip and run it again.
- Resolve the conflict yourself on the slice branch, then ask for a re-run of verify and review. The evidence must
  match the new slice head before it can merge.

## The test plan is never approved

**Symptom:** the slice escalates after 2 test-plan revisions.

**Cause:** usually the slice spec is unclear. The acceptance criteria cannot be tested as written, or the slice
is too big.

**Fix:** read the code-reviewer's last objection in the escalation. Then tighten the acceptance criteria, mark the
untestable ones as "not verifiable here" with a reason, or split the slice. The coordinator can send the slice
back to the planner.

## Too many permission prompts

**Cause:** routine commands are not in your allow list.

**Fix:** run `/shipyard:setup`, which merges the allow rules from `settings.example.json` into your project's
`.claude/settings.json` and records your test command. (Or copy the `permissions.allow` entries by hand and add
your test command, for example `Bash(npm test:*)`.) The rules apply the next time you launch. Hooks still apply,
so this does not loosen the hard rules.

## Cost is too high

| Lever | Effect |
|---|---|
| Brainstorm breadth 0 at P0 | Skips the goldfish brainstorm. Use it when the shape of the work is already decided. |
| Breadth 1 instead of 2 | Three lenses instead of five plus a sweep. |
| Mechanical slices | Keep renames, version bumps, formatting and generated code in their own slices. The simplicity reviewer is skipped there, and fewer reviewers are triggered. |
| Smaller slices | Smaller diffs mean shorter reviews and fewer fix rounds. |
| C-9 cost budget | Set a cost budget at intake. The coordinator records it in `PROJECT.md` and plans within it. |
| Compute classes | Move a mode from `DEEP` to `STANDARD` in the registry. Run its evals first. See [extending.md](extending.md#change-compute-for-a-role). |
