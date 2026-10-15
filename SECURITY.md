# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

- Use the repository's private vulnerability reporting ("Report a vulnerability" on the Security tab), or
- contact a maintainer listed in `.github/CODEOWNERS` privately.

Include what you found, how to reproduce it, and the impact you expect. We aim to reply within 7 days and to
agree a fix and disclosure date with you. Please give us a reasonable time to fix the problem before you
publish.

## Scope

In scope:

- The hook scripts in `hooks/scripts/` — for example a way for a Shipyard agent to push, write outside its
  allowed paths, or write code before the test plan is approved, without the hook blocking it.
- The helper scripts in `scripts/` — for example `shipyard_state.py` accepting a protected branch.
- Agent prompts, skills and workflows that would lead a Shipyard agent to leak secrets into `.ai/`, push to a
  remote, or act on a protected branch.

Out of scope:

- Bugs in Claude Code itself. Report those to the Claude Code project.
- Problems that need an attacker who can already edit your plugin files, settings or hooks.
- Findings that Shipyard's own reviewers make about *your* code. Those are the product working.

## Hooks are guardrails, not a sandbox

Shipyard's eight hooks block the mistakes that matter most: pushing, touching protected branches, writing
outside an agent's scope (by editor or by shell), writing code before the test plan is approved, mutating commands
from read-only roles, the goldfish reading planning notes, secrets in `.ai/`, and missing or stale review files. They are **guardrails**:

- They inspect tool calls with simple, conservative rules. A determined or creative command can still get past a
  pattern match.
- They apply only to Shipyard agents (`agent_type` starting with `shipyard:`). Your normal sessions are not
  checked.
- They do not isolate the file system, the network or processes.

Treat Shipyard like any other tool that runs commands in your repository: run it on code you trust, keep
secrets out of the working tree, use Claude Code's permission settings, and review every merge — which
Shipyard asks you to do anyway. If you need real isolation, run Claude Code inside a container or VM.

## Secrets

Shipyard never needs your credentials. `.ai/` is committed to the notes branch (which you may push), every agent
reads it, and briefs quote it, so the secrets-guard hook blocks content that looks like a secret there. Never paste secrets into a Shipyard conversation.
