---
description: Guided one-time setup for Shipyard — checks your environment, wires up permissions, and records your test command.
---

# Shipyard setup

You are running the guided Shipyard setup for the user, in their project folder. Work through the three steps
below in order, talking to the user in plain language. Keep it short: a line per check, a question when you
need one, and a clear "you're ready" at the end. Do not start any Shipyard workflow or write to `.ai/` — this
is only setup.

The plugin's files are at `${CLAUDE_PLUGIN_ROOT}`. The project is `$CLAUDE_PROJECT_DIR` (fall back to the
current directory if that is unset).

## Step 1 — Preflight

Run these checks and report each as a one-line ✓ / ✗ with the value you found. Do not fix anything yet; just
report, and at the end list anything that failed.

1. **Claude Code version** — run `claude --version`. Need **2.1.300 or later**. Compare numerically.
2. **Python** — run `python3 --version`. Need **3.9 or later** (the hooks and scripts need it).
3. **git repository** — run `git rev-parse --is-inside-work-tree` in the project. It must print `true`.
   Shipyard needs a git repo to make branches and local merges.
4. **Dynamic workflows** — these must be on, or the three saved workflows cannot run. You cannot read the live
   `/config` toggle from here, so instead: look for `"disableWorkflows": true` in the project's
   `.claude/settings.json` and in `~/.claude/settings.json`. If you find it, that is a ✗ (tell the user to
   remove it). If you do not, report it as "not disabled in settings — confirm the Dynamic workflows row is on
   in `/config` (on by default on paid plans)".

If any hard check (1–3) fails, say so plainly and stop before Step 2 — setup cannot complete until it is fixed.

## Step 2 — Permissions and your test command

Shipyard runs many small read-only commands (git status/diff, its own scripts, the three workflows). Without
allow-rules the user is asked about each one. This step merges Shipyard's rules into the project's
`.claude/settings.json` without disturbing anything already there.

1. **Ask the user for their test command** — for example `npm test`, `pytest`, `go test ./...`, `cargo test`.
   One line: "What command runs your tests? (I'll allow it so you aren't prompted. Press enter to skip.)"
2. **Preview, then apply.** First run a dry-run so the user sees exactly what will change:

   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/install_settings.py" --project "${CLAUDE_PROJECT_DIR:-$PWD}" --dry-run
   ```

   Then apply it, passing the test command if they gave one (repeat `--test-command` for several):

   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/install_settings.py" --project "${CLAUDE_PROJECT_DIR:-$PWD}" --test-command "<their command>"
   ```

   The script creates `.claude/settings.json` if it is missing, unions the rules into it, and is safe to run
   again. If it reports the file is not valid JSON, do not overwrite it — show the error and let the user fix
   the file, then re-run.

## Step 3 — Confirm and hand off

Tell the user the result in a few lines:

- A ✓/✗ summary of the preflight, with the exact fix for anything that failed.
- What was added to `.claude/settings.json` (or "already set — nothing to change").
- **How the new permissions take effect.** They are read when a session starts, so:
  - If you are a normal session: "Launch the coordinator next — it reads the fresh settings, so there's
    nothing more to restart:"

    ```bash
    claude --agent shipyard:coordinator --model opus --effort max
    ```

  - If you are the `shipyard:coordinator` session (the user ran setup from inside a run): say the rules will
    apply the **next** time they launch, and to relaunch the coordinator to pick them up.
- End with: "Then describe the job in plain words."
