# Extending Shipyard

Shipyard is built to change in small, safe steps. Workflows know roles. The registry maps roles to agents.
Abilities hold expertise. Contracts fix what comes back. So most changes touch one layer.

| You want to | Touch |
|---|---|
| Make a reviewer better at its job | Its capability skill only |
| Add a language | `skills/lang-packs/references/<language>.md` |
| Add a reviewer | An agent shell, a skill, a registry entry, the coordinator allowlist, hooks, docs |
| Move a role to cheaper or stronger compute | `registry/roles.json` (and the agent's frontmatter default) |
| Change what an agent returns | Its contract, with a version bump |

## Add a reviewer role

Example: an `accessibility-reviewer`.

1. **Agent shell.** Create `agents/accessibility-reviewer.md`. Copy an existing reviewer as a model. Keep it
   short: identity, jurisdiction, inputs per mode (`PLAN`, `SLICE`, `RECHECK`), hard constraints, return contract.
   Leave `Agent` out of `tools`. Set `model` and `effort` to the role's default class. List its skills under
   `skills:`, starting with `shipyard-framework`.
2. **Capability skill.** Create `skills/accessibility-review/SKILL.md` with a `version:` line in its body header,
   and `CHANGELOG.md` starting with `## 1.0.0 — <date> — initial`. Put long guidance in `references/`.
3. **Registry entry.** Add a role to `registry/roles.json` → `roles`, for example `accessibility-review`, with its
   agent, modes and classes, and `"contract": "reviewer-result@1"`. Reuse the reviewer-result contract, so the
   workflows need no change.
4. **Routing.** Add an entry to `routing.slice` (and `routing.plan` if it should critique plans) with the
   trigger that calls it. If you need a new trigger, add it to `triggerDefinitions` and teach the verifier to
   report it in `routingFacts`. That changes the verify-result contract, so see versioning below.
5. **Allowlist.** Add `shipyard:accessibility-reviewer` to the `Agent(...)` list in `agents/coordinator.md`.
6. **Hooks.** Make sure write-scope, readonly-bash and findings-gate treat the new agent as a reviewer. Add hook
   tests for it.
7. **Evals.** Add ability evals under `evals/abilities/accessibility-review/`. See [evals.md](evals.md).
8. **Docs and checks.** Run `python3 scripts/gen_docs.py` and `python3 scripts/check.py`. Update diagrams 03 and
   05 and the routing table in [slice-loop.md](slice-loop.md).

## Add an ability

An ability is a capability skill that one or more agents load.

1. Create `skills/<ability>/SKILL.md`, a `version:` line, `CHANGELOG.md`, and `references/` if needed.
2. Add it to the `skills:` frontmatter of each agent that should preload it.
3. Add it to those roles' `skills` lists in `registry/roles.json`.
4. Add evals under `evals/abilities/<ability>/`.

## Add a language pack

1. Create `skills/lang-packs/references/<language>.md`. Cover the canonical build and test commands (for example
   `npm test`, `go test ./...`, `pytest`, `cargo test`), idioms reviewers should expect, and common traps.
2. Add the file to the table in `skills/lang-packs/SKILL.md` so agents know when to read it.
3. Add a line to `skills/lang-packs/CHANGELOG.md` and bump the minor version.
4. Add an eval case that uses a small repo in that language.

## Change compute for a role

1. Edit the mode's class in `registry/roles.json` → `roles.<role>.modes`. Classes are `DEEP` (opus, high) and
   `STANDARD` (sonnet, medium).
2. If you change the role's default, also change `model` and `effort` in the agent file.
3. Never set a delegate above the coordinator's own session (`opus`, `max`).
4. Run the process evals for that role to check quality held.

Workflows read the registry on every launch, so no workflow edit is needed.

## Contract versioning

Every contract has `"x-contract-version"` and a stable `"$id"`. The registry refers to contracts by name and
major version, for example `reviewer-result@1`.

| Change | Bump | Example |
|---|---|---|
| Add an optional field | Minor (1.0.0 → 1.1.0) | A new optional `extras` key |
| Loosen a rule | Minor | Allow a longer string |
| Fix a description | Patch | Clearer wording |
| Add a required field | Major (1.x → 2.0.0) | Every reviewer must now return `durationSeconds` |
| Remove or rename a field | Major | `counts` becomes `totals` |
| Narrow an enum or type | Major | Drop a severity value |

A major bump is breaking. Update every agent that returns the contract, every workflow that reads it, the
registry reference, and `registry.workflowContractMajor` where a workflow's own return changed. Agents may
change how they work freely, as long as the output still matches the contract.

## Ability CHANGELOGs and evals

Each ability has its own `CHANGELOG.md` and its own evals. Bump the ability's version when you change it:

- Patch for wording fixes.
- Minor for new guidance or a new reference file.
- Major for a change in what the ability considers a finding, or in severity rules.

Run that ability's evals before and after. The version is reported back in each reviewer's `abilityVersions`, and
ends up in the slice evidence, so you can tell which version reviewed which slice.

## Regenerate the docs

The per-agent pages in `docs/agents/` are generated from the agent frontmatter and the registry. Do not edit them
by hand.

```bash
python3 scripts/gen_docs.py          # rewrite docs/agents/
python3 scripts/gen_docs.py --check  # fail if they are out of date
```

## The diagram rule

If you change a phase, a gate, a role or a contract, the diagrams must change too. The pull request template asks
about this.

- Each diagram lives in `docs/diagrams/NN-<slug>.mmd` and is also embedded as a ```` ```mermaid ```` block in a doc.
  The two copies must be identical.
- Re-render the `.svg` next to the `.mmd` with mermaid-cli.
- Use stable syntax only, so GitHub renders it: `flowchart TD` or `LR`, `stateDiagram-v2`, `sequenceDiagram`,
  `gitGraph`. No HTML in labels. Quote any label with special characters. Keep each diagram to about 25 nodes.
