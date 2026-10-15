# Shipyard hooks

Eight small Python 3 scripts (standard library only, Python 3.9+) that make Shipyard's most important rules hard
to break. `hooks.json` wires them into Claude Code. `scripts/shipyard_hooklib.py` holds the shared code.

**Guardrails, not a sandbox.** The hooks look at tool calls by pattern. They stop the mistakes an agent is likely
to make. They cannot see what a program does once it runs (a script can still write files), and a determined
agent could find a command form they miss. For stronger isolation, enable Claude Code sandboxing, and keep
branch protection on your remote.

## Who they apply to

Every hook first reads `agent_type` from the hook input. If it is missing, or does not start with `shipyard:`,
the hook exits 0 at once. Your normal sessions are never affected, even with the plugin enabled. For every
Shipyard agent, including the coordinator, the hooks apply.

A hook blocks by printing the reason on stderr and exiting with code 2. The agent sees the reason and can
correct course. If a hook itself crashes while checking a Shipyard agent, it blocks (fail closed) and says so.

The hooks find the project from `CLAUDE_PROJECT_DIR` (or the input `cwd`), read `.ai/state.json`, and read the
active slice's `.ai/slices/<id>/SLICE.md` touch sets:

```markdown
## Expected touch set — code
- src/cache/**
## Expected touch set — tests
- tests/cache/**
```

The heading may use an em dash or a plain hyphen. Globs are relative to the project; `**` matches any depth.
Paths in tool calls are resolved (symlinks too) and made relative to the project. A path outside it is denied.

## The eight hooks

| Hook | Event and matcher | Applies to | What it blocks | Why |
|---|---|---|---|---|
| `protect-branches.py` | PreToolUse `Bash` | all Shipyard agents | see below | Your remote and protected branches stay untouched. Work reaches the feature branch only through the coordinator's `--no-ff` merge of an approved slice. |
| `write-scope.py` | PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` and `Bash` | all Shipyard agents | writes outside the agent's row in the table below; any editor write outside the project; for Bash, every project path the command visibly writes (`shipyard_hooklib.bash_write_targets`), any write inside `.git/`, and any shell write to `TEST_PLAN.md`; verifier edits to an `APPROVED` test plan other than a full rewrite as `DRAFT` | Each agent touches only what it owns. |
| `test-plan-gate.py` | PreToolUse `Edit\|Write\|MultiEdit\|NotebookEdit` and `Bash` | implementer, verifier | any write outside `.ai/`, by editor or shell, until `.ai/slices/<active>/TEST_PLAN.md` has `Status: APPROVED` in its first 10 lines | Test plan first. |
| `readonly-bash.py` | PreToolUse `Bash` | discovery, goldfish, architect, planner, the six reviewers | installs, git state changes, file deletion, writes outside `.ai/`, mutating HTTP calls | Planning and review roles check facts; they do not change them. |
| `goldfish-blinders.py` | PreToolUse `Read\|Grep\|Glob` | goldfish | reads under `.ai/` other than a `SLICE.md`; Grep/Glob patterns or paths that reach into `.ai/`; content searches from a folder that contains `.ai/` | The goldfish stays cold. |
| `secrets-guard.py` | PreToolUse `Edit\|Write\|MultiEdit` into `.ai/**` | all Shipyard agents | content that looks like a secret | `.ai/` is committed to the notes branch, read by every agent and quoted in briefs. Secrets never belong there. |
| `findings-gate.py` | SubagentStart and SubagentStop, `shipyard:(code\|security\|contract\|integration\|reliability\|simplicity)-reviewer` | the six reviewers | stopping without a findings file that parses and was written after this reviewer started (the start time is kept in the system temp folder, keyed by `agent_id`); sent back at most 3 times; a `Mode: REBUTTAL` run (read from `agent_transcript_path`) writes no file and is not gated | A missing or stale review is never a clean review. |
| `brief-check.py` | PreToolUse `Agent\|Task` | the coordinator calling a `shipyard:` agent | a brief without `Caller: shipyard:coordinator` first, a `Mode:` that is not a mode of that role in `registry/roles.json`, or (FIX, FIX_TESTS, RECHECK) a missing `Round: n` or n above `limits.fixRounds` | Direct calls follow the same modes and caps as the workflows. Agents started inside workflows are not affected. |

### protect-branches

Protected branches are `main`, `master`, `state.json` → `protectedBranches` (glob patterns such as `release/*`
work), `state.json` → `baseBranch`, and the repository's default branch (`git symbolic-ref --short
refs/remotes/origin/HEAD`, when set). The current branch comes from `git rev-parse --abbrev-ref HEAD`.

- Any `git push` (also `send-pack`, `http-push`), `gh pr merge`, `gh pr create` and `gh repo sync`: denied.
- `git reset --hard`, `git rebase`, `git cherry-pick`, `git am`, `git filter-branch`, `git filter-repo`,
  `git update-ref`, `git replace`, `git pull`, and `git symbolic-ref <name> <ref>`: denied. Any other `git reset`
  that moves the branch is denied while on a protected branch.
- `git commit` by the coordinator: denied (it only merges). `git add` of a `.ai` path, or any forced add
  (`-f`, `--force`): denied for every agent, because `.ai/` never enters a work branch (it reaches git only through
  `shipyard_state.py snapshot`, onto the notes branch).
- The notes branch (`state.json` → `notesBranch`): never checked out, switched to, reset, moved, deleted, merged or
  given a worktree.
- `git revert`: only the coordinator, only on the feature branch (to back out a slice merge whose post-merge tests
  failed, on the human's yes).
- `git fetch` with a refspec that writes a local branch (`src:dst`, `--update-head-ok`): denied. Plain `git fetch`
  and fetches into `refs/remotes/` are allowed.
- `git worktree add` on a protected branch (or `-b/-B` creating one): denied. Only the coordinator manages worktrees.
- Branch-changing git commands (commit, merge, reset, revert, checkout, switch, branch, worktree, fetch, …) after a
  `cd`, `pushd` or `popd` on the same command line, including inside a `!` git alias: denied, because the hook
  judges the branch of the folder the command runs in. `git -C <dir>` is resolved and allowed.
- `git commit`: never on a protected branch. The implementer and verifier commit only on `state.sliceBranch`; the
  coordinator on the slice branch or the feature branch. Other agents never commit.
- `git merge`: only the coordinator, only while the feature branch is checked out, only with `--no-ff`, and only
  from `state.sliceBranch` or a `<featureBranch>-slice-*` branch. `git merge --abort` is allowed. `--squash`,
  `--ff-only`, `--continue` are denied.
- `git checkout`, `git switch`, creating, deleting or renaming branches: only the coordinator. It may not delete
  or rename the feature branch or a protected branch, and may not `checkout -B` / `switch -C` onto one.
- Read-only git (`log`, `diff`, `show`, `status`, `rev-parse`, `ls-files`, `blame`, branch listing) is allowed.

The command line is parsed conservatively: it is split on `;`, `&&`, `||`, `|`, `&` and new lines; environment
prefixes and wrappers (`env`, `timeout`, `xargs`, ...) are skipped; `git -C <dir>` and `git -c` are understood;
`bash -c '...'`, `eval`, `$(...)`, backticks and `find -exec` bodies are checked as commands of their own; git
aliases are resolved; here-document bodies are not treated as commands. A `git checkout x && git commit` is
judged against branch `x`.

### write-scope

| Agent | May Write/Edit |
|---|---|
| coordinator | `.ai/**` (including `state.json`) only; never the project's `.gitignore`. It may not set `Status: APPROVED` in a `TEST_PLAN.md`. |
| discovery | `.ai/**` except `ARCHITECTURE.md`, `INVARIANTS.md`, `state.json`, `slices/**` |
| goldfish | nothing |
| architect | `.ai/ARCHITECTURE.md`, `.ai/INVARIANTS.md`, `.ai/decisions/**`, `.ai/planning/architect.md`, `.ai/slices/*/findings/architect*.md` |
| planner | `.ai/DELIVERY_PLAN.md`, `.ai/slices/*/SLICE.md`, `.ai/planning/planner.md` |
| implementer | the active slice's code touch set; never the test touch set (the test set wins when both match); never `.ai/**` |
| verifier | the active slice's test touch set; `.ai/slices/<active>/TEST_PLAN.md` (never writing `Status: APPROVED`); `.ai/slices/<active>/findings/verifier*.md` |
| each reviewer | `.ai/slices/*/findings/<name>.md`, `.ai/slices/*/findings/<name>.test-plan.md`, `.ai/planning/<name>.md` |

The code-reviewer may also make one change to the active slice's `TEST_PLAN.md`: the Edit tool with
`old_string` exactly `Status: DRAFT` and `new_string` exactly `Status: APPROVED` (no `replace_all`), while the
file's status line says DRAFT. Any other change to that file is denied.

The verifier check looks at the result, not just the text: an edit that turns `DRAFT` into `APPROVED` piece by
piece is denied too. If `state.json`, `activeSlice`, `SLICE.md` or a touch-set section is missing, the
implementer and verifier are denied with a message naming what is missing.

### readonly-bash

For discovery, architect, planner and the six reviewers:

- Package installs and publishes are denied: `npm`/`pnpm` `install|i|ci|add|...`, `yarn` (bare) and
  `yarn add|install`, `pip install`, `python -m pip install`, `uv add|sync`, `poetry add|install`,
  `cargo add|install`, `go get|install`, `go mod tidy`, `gem install`, `bundle install`, `apt`/`apt-get`,
  `brew` and other system package managers, `composer require|install`.
- Builds and tests stay allowed: `npm test`, `npm run build`, `pytest`, `go test`, `cargo test`, `cargo build`,
  `mvn -q test`, `gradle test`, `make test`, and so on.
- Git is limited to a read-only list (`log`, `diff`, `show`, `status`, `rev-parse`, `ls-files`, `blame`, `grep`,
  branch and tag listing, `stash list`, `config --get`, ...). Everything else is denied, including `commit`,
  `merge`, `rebase`, `reset`, `checkout`, `switch`, `stash`, `tag v1`, branch create or delete, `push`, `pull`,
  `fetch`, `add`.
- `rm`, `rmdir`, `mv`, `chmod`, `chown`, `truncate`, `dd`, `ln`, `sed -i`, `find -delete|-exec`, `sudo`: denied.
- Output redirection (`>`, `>>`, `&>`), `tee`, `cp`, `touch`, `mkdir` to a path outside `.ai/`: denied.
  `/dev/null` and `2>&1` are fine.
- `curl` with `-X POST|PUT|PATCH|DELETE`, `-d`/`--data*`, `--json`, `-F`, `-T`; `wget --post-data`; downloads
  saved outside `.ai/`: denied.

The goldfish gets only: `ls`, `cat`, `grep`, `rg`, `find` (no `-exec`/`-delete`), `git log|show|diff|ls-files`,
`wc`, `head`, `tail`, `pwd`, `cd`, and no output redirection except to `/dev/null`.

### secrets-guard

Scans `content`, `new_string` and each MultiEdit `new_string` of writes into `.ai/` for: private key blocks;
cloud access key IDs (`AKIA...`); `api_key|secret|token|password` assignments with a long value; JSON Web
Tokens; connection strings with `Password=` or `AccountKey=`; URLs with `sig=` or `user:pass@`; `ghp_` and
`github_pat_` tokens; `xox[baprs]-` chat tokens. `<REDACTED>` is always fine. A denial names the pattern and
line (never the value) and tells the agent to write `<REDACTED>` and record where the secret lives.

### findings-gate

When a reviewer stops, its findings file must exist and parse. With `state.activeSlice` set, the hook checks
the most recently modified of `.ai/slices/<id>/findings/<name>.md` and `<name>.test-plan.md`; otherwise
`.ai/planning/<name>.md`. A valid file starts with the agent banner line (`> 🤖 AGENT FILE. ...`), then has
either a line `NO FINDINGS` or at least one block with `ID:`, `Severity:` (BLOCKING, MAJOR, MINOR or NOTE) and
`Evidence:`. If the input says `stop_hook_active: true`, the hook lets the reviewer stop and notes it on
stderr, so a reviewer can never loop forever.

## Debugging

1. Read the reason on stderr. It names the rule and the file or branch involved.
2. Set `SHIPYARD_HOOK_DEBUG=1` before launching Claude Code. The hooks then write their decisions to stderr,
   which Claude Code shows in its debug output (`claude --debug`).
3. Check `.ai/state.json` (`activeSlice`, `sliceBranch`, `featureBranch`) and the active `SLICE.md` headings.
4. Run a hook by hand:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push"},"agent_type":"shipyard:implementer","cwd":"."}' \
  | SHIPYARD_HOOK_DEBUG=1 python3 hooks/scripts/protect-branches.py; echo "exit $?"
```

Exit 0 means allow; exit 2 means block.

## Tests

```bash
python3 -m unittest discover -s hooks/tests -v
```

The suite builds a throwaway git repository (`main`, `develop` as the remote default, `release/1`,
`feature/x`, `feature/x-slice-01`), writes `.ai/state.json`, `SLICE.md` and `TEST_PLAN.md`, then runs each
script with JSON on stdin and checks the exit code and message. Add a test whenever you change a rule.


> **Outside a Shipyard project run** (no `.ai/state.json`, for example a one-off review or an ability eval), `findings-gate` does nothing.
