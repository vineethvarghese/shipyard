# ADR-0004: Workflows name roles; a registry maps roles to agents

- Status: Accepted
- Date: 2026-10-15

## Context

The process (which steps, in what order) changes slowly. The expertise of each agent (how to review well, how to
write a good test plan) should change often. If workflows name agents directly and agents hold all their expertise
in one prompt, every improvement touches the process, and every process change risks breaking an agent.

## Options considered

1. **Workflows call agents by name; each agent holds its expertise in its prompt.** Simple, but tightly coupled.
2. **Workflows call roles; a registry maps roles to agents, compute and contracts; expertise lives in versioned
   capability skills; returns are versioned contracts.**

## Decision

Use option 2.

- `registry/roles.json` maps each role to its agent, the compute class per mode, routing triggers and contract.
  The coordinator passes it to every workflow.
- Agent shells in `agents/*.md` stay short: identity, limits, inputs, return contract.
- Capability skills in `skills/<ability>/` hold the expertise. Each has a version, a changelog and its own evals.
- Contracts in `contracts/*.schema.json` fix what each role returns, with semantic versions.

## Consequences

- An ability can improve without any workflow change, as long as its agent still returns a valid contract.
- Compute can move between classes by editing data, not code.
- A new reviewer can reuse the reviewer-result contract and plug into routing with a registry entry.
- There are more files to keep in step. `scripts/check.py` checks that the registry points at real agents,
  contracts and skills.
- Contract changes need care: a major version bump is breaking and touches every producer and consumer.
