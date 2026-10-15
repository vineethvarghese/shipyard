# Guardrails: the eight hooks

Prompts tell agents the rules. Hooks make the important rules hard to break. Shipyard ships eight hooks in
`hooks/hooks.json`. Each is a small Python script in `hooks/scripts/` using only the standard library.

## Scope

- Every hook does **nothing** unless the stdin field `agent_type` starts with `shipyard:`. Your normal Claude Code
  sessions are not affected, even with the plugin enabled.
- For Shipyard agents, including the coordinator, they apply.
- Hooks read `.ai/state.json` and the active slice's `SLICE.md` touch sets.
- If `state.json` is missing, write-scope and test-plan-gate deny Shipyard agents that need state, with a clear
  message.
- A hook blocks with exit code 2 and a reason on stderr. The agent sees the reason.

## The hooks

| Hook | Event | Applies to | Blocks | Why |
|---|---|---|---|---|
| protect-branches | PreToolUse `Bash` | All Shipyard agents | Any `git push`. Merge, commit, reset or revert while on a protected branch; rebase, cherry-pick, `update-ref`; `git fetch` into a local branch (`src:dst`); a worktree on a protected branch; branch-changing git commands after a `cd` on the same line (use `git -C`). Only the coordinator reverts, and only on the feature branch. The coordinator never commits; nobody `git add`s `.ai/` or force-adds ignored files; the notes branch is never checked out, merged, moved or deleted. | Your base branch and remote stay untouched ([ADR-0003](decisions/ADR-0003-local-merge-never-main.md)). |
| write-scope | PreToolUse `Edit\|Write\|Bash` | Each Shipyard agent, by role | Writes outside that agent's allowed paths. For editor tools, any write outside the project. For Bash, every project path the command visibly writes (redirects, `tee`, `sed -i`, `cp`, `mv`, `rm`, `touch`, `git rm/mv/restore`); writes inside `.git/`; and any shell write to `TEST_PLAN.md`. After approval, the verifier may change `TEST_PLAN.md` only by rewriting it whole as `Status: DRAFT`. | Each agent touches only what it owns. The implementer cannot edit tests, the verifier cannot edit code, and an approved test plan cannot be quietly thinned. |
| test-plan-gate | PreToolUse `Edit\|Write\|Bash` | implementer, verifier | Code or test writes, by editor or shell, before the slice's `TEST_PLAN.md` says `Status: APPROVED`. (Stopping the verifier from writing `Status: APPROVED` itself is write-scope's job.) | Test plan first ([ADR-0002](decisions/ADR-0002-test-plan-first.md)). |
| readonly-bash | PreToolUse `Bash` | Reviewers, architect, planner, discovery, goldfish | Commands that change tracked files, git state or installed packages | Reviewers and planners may check facts but not change them. |
| goldfish-blinders | PreToolUse `Read\|Grep\|Glob` | goldfish | Reading anything under `.ai/` except a `SLICE.md`, and content searches from a folder that contains `.ai/` | The goldfish must stay cold: the elephant's sealed take and the planning notes would anchor it. |
| secrets-guard | PreToolUse `Edit\|Write` into `.ai/**` | All Shipyard agents | Content that looks like a secret, for example API keys, tokens and private key blocks | `.ai/` is committed to the notes branch, every agent reads it, and briefs quote it. Secrets must never land there. |
| findings-gate | SubagentStart, SubagentStop | Reviewers | Stopping without a findings file that exists, was written during this run, and parses (`NO FINDINGS` or well-formed finding blocks). A reviewer is sent back up to 3 times. A reviewer answering a rebuttal (`Mode: REBUTTAL`) writes no file and is not gated. | No silent, stale or malformed review. A missing review is never a clean review. |
| brief-check | PreToolUse `Agent\|Task` | The coordinator calling a `shipyard:` agent | A brief that does not start with `Caller: shipyard:coordinator`, lacks a valid `Mode:` for that role, or (for FIX, FIX_TESTS, RECHECK) lacks `Round: n` with n at most 3 | Direct calls follow the same modes and caps as the workflows. It does not affect agents started inside workflows. |

### Allowed writes per agent (write-scope)

| Agent | May write or edit |
|---|---|
| coordinator | `.ai/**` (including `state.json`) only. Never the project's `.gitignore`: `.ai/` is ignored through `.git/info/exclude`. |
| discovery | `.ai/**` except `ARCHITECTURE.md`, `INVARIANTS.md`, `state.json`, `slices/**` |
| goldfish | Nothing. It returns structured output only. |
| architect | `.ai/ARCHITECTURE.md`, `.ai/INVARIANTS.md`, `.ai/decisions/**`, `.ai/planning/architect.md`, its findings files |
| planner | `.ai/DELIVERY_PLAN.md`, `.ai/slices/*/SLICE.md`, `.ai/planning/planner.md` |
| implementer | The active slice's code touch set. Never the test touch set. Never `.ai/**`. |
| verifier | The active slice's test touch set; `.ai/slices/<active>/TEST_PLAN.md` (never setting APPROVED); its findings file |
| reviewers | Their own findings files only. The code-reviewer may also flip `Status: DRAFT` to `Status: APPROVED` in `TEST_PLAN.md`, and nothing else in that file. |

## Not a sandbox

Hooks are guardrails, not a security boundary.

- They inspect tool calls by pattern. A determined or confused agent could find a command form a pattern misses.
- Shell writes are checked only where the command shows them: redirects, `tee`, in-place editors, `cp`, `mv`, `rm`,
  `touch`, `curl -o`, `wget -O` and git path commands. Commands that write paths the line does not show (`git apply`,
  `patch`, `git stash pop`, archive extraction into the project, `curl -O`) are refused, and so is any relative
  write after a `cd`. A program that writes files itself (`python -c`, `node -e`, a build script) is not seen. The slice workflow's scope check (VERIFY lists every changed path against the touch sets) and the reviewers
  are the backstop for those.
- They do not limit network access, CPU or what a test run does.
- They only see tool calls. They cannot see what a program does once it runs.

Run Shipyard on code and machines you would let a careful colleague use. Keep your usual protections: branch
protection on the remote, review of the final pull request, and no production credentials in the shell.

## Debugging a hook

If a hook blocked something you did not expect:

1. Read the reason. The agent sees it on stderr, and the coordinator reports it.
2. Set `SHIPYARD_HOOK_DEBUG=1` in the environment before launching Claude Code. The hooks then print extra
   detail about how they reached each decision.
3. Check `.ai/state.json`: the active slice and slice branch must be right.
4. Check the active `SLICE.md` touch sets. The headings must be `## Expected touch set — code` and
   `## Expected touch set — tests` (an em dash; a plain `-` is also accepted), with one `- path/glob` per line.
5. Run the hook by hand with a sample input:

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push"},"agent_type":"shipyard:implementer","cwd":"."}' \
  | python3 hooks/scripts/protect-branches.py; echo "exit $?"
```

Exit 0 means allow. Exit 2 means block.

## Testing the hooks

Every allow and deny rule has a unit test:

```bash
python3 -m unittest discover -s hooks/tests
```

Add a test whenever you change a hook.


> **Outside a Shipyard project run** (no `.ai/state.json`, for example a one-off review or an ability eval), `findings-gate` does nothing, so reviewers can be used on their own.
