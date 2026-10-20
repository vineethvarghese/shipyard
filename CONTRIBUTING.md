# Contributing to Shipyard

Thanks for helping. Shipyard is small on purpose: plain Markdown agents and skills, three JavaScript workflow
scripts, Python hooks and scripts that use only the standard library, and JSON contracts. Keep it that way.

## Ground rules

- **Generic only.** No company, product-team, cloud-vendor or person names in the repo (credits live in
  `NOTICE` and the README's Credits section). Use neutral examples such as `npm test`, `go test ./...`, `pytest` or `cargo test`.
  `scripts/check.py` scans for a list of banned words.
- **Paraphrase books, never quote them.** Cite by author, title and topic.
- **Nothing pushes.** No script, hook, workflow or agent in this repo may push to a remote.
- **Plain, short sentences** in docs. Direct, imperative voice in agent and skill prompts.

## Dev setup

You need git, Python 3.9+ and Node 22. Nothing to install: there are no third-party dependencies.

```bash
git clone <your fork> shipyard && cd shipyard
claude --plugin-dir .          # try your working copy in Claude Code
```

## Tests to run before a pull request

These are exactly what CI runs:

```bash
python3 scripts/check.py                          # JSON, contracts, frontmatter, registry, workflows, banned words
python3 -m unittest discover -s hooks/tests       # every hook allow/deny rule
python3 -m unittest discover -s tests/scripts     # validator, state helper, check.py, gen_docs, link checker
node --test tests/workflows/                      # workflows with stand-in agents
python3 scripts/gen_docs.py --check               # generated agent pages are up to date
python3 scripts/check_links.py                    # every relative Markdown link resolves
```

If you changed an agent, a skill or a workflow, also run the matching evals (`claude plugin eval .`, see
[docs/evals.md](docs/evals.md)) and say in the pull request which ones you ran. Evals cost tokens; CI does not
run them.

## The diagram rule

**A diagram changes with the behaviour it shows.** If your change alters a phase, a gate, a role, a contract, a
hook or the branch model, update the matching diagram in `docs/diagrams/*.mmd` (and its rendered `.svg`) and
the page that explains it, in the same pull request. The README's hero diagram must stay identical to
`docs/diagrams/01-hero.mmd`; `check.py` enforces that one. The pull request template asks about the rest.

## Contracts and versioning

Contracts live in `contracts/*.schema.json` (JSON Schema draft 2020-12). Each has `$id`, `title` and
`x-contract-version` (`MAJOR.MINOR.PATCH`).

- **Patch**: descriptions and wording only.
- **Minor**: a new optional property, or a new enum value that every consumer already tolerates.
- **Major**: anything a consumer could break on — a new required property, a removed or renamed property, a
  narrowed type or enum. Bump the major, update `registry/roles.json` (`"reviewer-result@2"`), the workflows that
  use it, `workflowContractMajor` if a workflow's return changes, the tests and the docs.

`check.py` fails if the registry asks for a major version a contract file does not have.

## Adding things

Step-by-step guides are in [docs/extending.md](docs/extending.md). In short:

- **A role** (for example a new reviewer): an agent shell in `agents/`, a capability skill, a registry entry with
  modes, compute classes, contract and routing triggers, the coordinator's `Agent(...)` allowlist, hook
  coverage and tests, evals, then `python3 scripts/gen_docs.py`.
- **An ability**: `skills/<ability>/SKILL.md` (with a `Version x.y.z` line), `CHANGELOG.md`, optional
  `references/`, evals under `evals/abilities/<ability>/`, and the ability added to the roles that load it.
- **A language pack**: `skills/lang-packs/references/<language>.md`, linked from `skills/lang-packs/SKILL.md`,
  plus an entry in that skill's `CHANGELOG.md`.

Every skill change bumps its version and adds a `CHANGELOG.md` entry.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, with types such as
`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, and a scope such as `agents`, `skills/<name>`, `hooks`,
`workflows`, `contracts`, `registry`, `scripts`, `docs`. Mark breaking changes with `!` and a `BREAKING CHANGE:`
footer — every major contract bump is one.

Keep commits small and focused. Generated files (`docs/agents/*.md`) go in the same commit as the change that
produced them.

## Pull requests

Fill in the template. It asks whether you changed a phase, gate, role, contract or hook, which diagram and docs
changed with it, which tests you ran and which evals you ran.
