# ADR-0006: Enforce the hard rules with hooks, not only with prompts

- Status: Accepted
- Date: 2026-10-15

## Context

Some rules must never break: never push, never change a protected branch, no code before an approved test plan,
each agent writes only its own files, no secrets in `.ai/`, every reviewer leaves a findings file. Prompts state
these rules, but a prompt is advice. Long sessions, tool errors and pressure to finish can all lead an agent to
break one.

Claude Code plugin hooks run before tool calls and when subagents stop. They can block a call and tell the agent
why. Hooks placed in a plugin agent's frontmatter are ignored, so plugin hooks must live in `hooks/hooks.json` and
check `agent_type` themselves.

## Options considered

1. **Prompt rules only.** Simple. No guarantee.
2. **Hooks for the rules that must hold, prompts for everything else.**
3. **A full sandbox.** Strongest, but outside what a plugin can ship, and heavy for users.

## Decision

Use option 2. Eight hooks in `hooks/hooks.json`, written in standard-library Python: protect-branches,
write-scope, test-plan-gate, readonly-bash, goldfish-blinders, secrets-guard, findings-gate and brief-check.
(The first version had seven; goldfish-blinders was added after an independent review showed the goldfish's
isolation was a prompt instruction only.) Each does nothing
unless `agent_type` starts with `shipyard:`, so normal sessions are untouched. Prompts still state the same rules,
so agents rarely hit a hook.

We did not add a hook that checks return contracts at SubagentStop. Workflows already check returns against
schemas, and such a hook could break agents that return structured output.

## Consequences

- The most important rules hold even when an agent forgets them.
- Each hook has unit tests for every allow and deny rule.
- Hooks are pattern-based guardrails, not a sandbox. The docs say so plainly.
- A hook can block something legitimate, such as a file the plan forgot to list. The block reason points to the
  fix, and `SHIPYARD_HOOK_DEBUG=1` shows more detail.
