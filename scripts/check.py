#!/usr/bin/env python3
"""Repository hygiene checks for Shipyard. Stdlib only.

    python3 scripts/check.py [--root PATH]

Checks:
  * every *.json file parses;
  * every contract has $id, title, x-contract-version and a root object type, and a sane schema shape;
  * agents/*.md frontmatter: name (= file name), description, tools, and only known keys;
  * every skill folder has SKILL.md (name = folder, description) and CHANGELOG.md;
  * registry/roles.json references existing agents, skills, contracts and compute classes,
    and every agent file is in the registry;
  * workflows/*.js start with `export const meta` and use no Date.now, Math.random, new Date(),
    import or require;
  * README.md's first Mermaid block matches docs/diagrams/01-hero.mmd (when both exist);
  * no banned (vendor-specific) words in any text file, except NOTICE.

Exits 0 when clean, 1 with a list of problems otherwise.
"""

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shipyard_frontmatter as fmlib  # noqa: E402

DEFAULT_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

ALLOWED_AGENT_KEYS = {
    "name", "description", "tools", "disallowedTools", "model", "effort", "maxTurns", "skills", "memory",
    "background", "isolation", "color", "omitClaudeMd", "initialPrompt",
}
REQUIRED_AGENT_KEYS = ("name", "description", "tools")
MODELS = {"opus", "sonnet", "haiku", "inherit"}
EFFORTS = {"low", "medium", "high", "xhigh", "max"}
JSON_TYPES = {"object", "array", "string", "integer", "number", "boolean", "null"}

# Stored reversed so this file does not trip its own scan.
_BANNED_REVERSED = ("tfosorcim", "eruza", "eruzasm", "evirdeno", "pecib", "tentod", "xnls", "rca",
                    "lahgnishsaka", "kooltuo")
BANNED_WORDS = tuple(w[::-1] for w in _BANNED_REVERSED)
BANNED_RE = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(BANNED_WORDS) + r")(?![A-Za-z0-9])", re.IGNORECASE)

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}
BANNED_SCAN_EXEMPT = {"NOTICE"}

WORKFLOW_FORBIDDEN = [
    (re.compile(r"\bDate\s*\.\s*now\b"), "Date.now"),
    (re.compile(r"\bMath\s*\.\s*random\b"), "Math.random"),
    (re.compile(r"\bnew\s+Date\b"), "new Date()"),
    (re.compile(r"^\s*import\b", re.MULTILINE), "import"),
    (re.compile(r"\bimport\s*\("), "import()"),
    (re.compile(r"\brequire\s*\("), "require()"),
]


def rel(root, path):
    return os.path.relpath(path, root).replace(os.sep, "/")


def walk_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        relative = rel(root, dirpath)
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS
                             and not (d == "results" and (relative + "/").startswith("evals/")))
        for name in sorted(filenames):
            yield os.path.join(dirpath, name)


def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------- JSON + contracts

def check_json_files(root, problems):
    for path in walk_files(root):
        if path.endswith(".json"):
            try:
                load_json(path)
            except (ValueError, UnicodeDecodeError) as exc:
                problems.append("%s: invalid JSON: %s" % (rel(root, path), exc))


def _schema_shape(schema, where, problems):
    if isinstance(schema, bool):
        return
    if not isinstance(schema, dict):
        problems.append("%s: schema must be an object or boolean" % where)
        return
    t = schema.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        bad = [x for x in types if x not in JSON_TYPES]
        if bad:
            problems.append("%s: unknown type %s" % (where, bad))
    if "enum" in schema and (not isinstance(schema["enum"], list) or not schema["enum"]):
        problems.append("%s: enum must be a non-empty list" % where)
    props = schema.get("properties")
    if props is not None:
        if not isinstance(props, dict):
            problems.append("%s: properties must be an object" % where)
            props = {}
        for key, sub in props.items():
            _schema_shape(sub, "%s.properties.%s" % (where, key), problems)
    req = schema.get("required")
    if req is not None:
        if not isinstance(req, list) or not all(isinstance(r, str) for r in req):
            problems.append("%s: required must be a list of strings" % where)
        elif isinstance(props, dict):
            for r in req:
                if r not in props:
                    problems.append("%s: required property %r is not defined in properties" % (where, r))
    ap = schema.get("additionalProperties")
    if ap is not None:
        if isinstance(ap, dict):
            _schema_shape(ap, where + ".additionalProperties", problems)
        elif not isinstance(ap, bool):
            problems.append("%s: additionalProperties must be a boolean or a schema" % where)
    if "items" in schema:
        _schema_shape(schema["items"], where + ".items", problems)
    for kw in ("minLength", "maxLength", "minItems", "maxItems"):
        if kw in schema and (not isinstance(schema[kw], int) or isinstance(schema[kw], bool) or schema[kw] < 0):
            problems.append("%s: %s must be a non-negative integer" % (where, kw))


def check_contracts(root, problems):
    cdir = os.path.join(root, "contracts")
    if not os.path.isdir(cdir):
        problems.append("contracts/: missing")
        return
    for name in sorted(os.listdir(cdir)):
        if not name.endswith(".json"):
            continue
        where = "contracts/" + name
        if not name.endswith(".schema.json"):
            problems.append("%s: contract files must be named <stem>.schema.json" % where)
        try:
            schema = load_json(os.path.join(cdir, name))
        except ValueError:
            continue  # reported by check_json_files
        if not isinstance(schema, dict):
            problems.append("%s: root must be an object" % where)
            continue
        for key in ("$id", "title", "x-contract-version"):
            if not schema.get(key):
                problems.append("%s: missing %s" % (where, key))
        version = schema.get("x-contract-version")
        if version and not re.match(r"^\d+\.\d+\.\d+$", str(version)):
            problems.append("%s: x-contract-version %r is not MAJOR.MINOR.PATCH" % (where, version))
        if schema.get("type") != "object":
            problems.append("%s: root type must be \"object\"" % where)
        _schema_shape(schema, where, problems)


# ---------------------------------------------------------------- agents + skills

def agent_names(root):
    adir = os.path.join(root, "agents")
    if not os.path.isdir(adir):
        return []
    return sorted(n[:-3] for n in os.listdir(adir) if n.endswith(".md"))


def skill_names(root):
    sdir = os.path.join(root, "skills")
    if not os.path.isdir(sdir):
        return []
    return sorted(n for n in os.listdir(sdir) if os.path.isdir(os.path.join(sdir, n)))


def check_agents(root, problems):
    names = agent_names(root)
    if not names:
        problems.append("agents/: no agent files")
    skills = set(skill_names(root))
    for name in names:
        where = "agents/%s.md" % name
        try:
            fm, body = fmlib.read(os.path.join(root, "agents", name + ".md"))
        except (fmlib.FrontmatterError, UnicodeDecodeError) as exc:
            problems.append("%s: %s" % (where, exc))
            continue
        for key in REQUIRED_AGENT_KEYS:
            if not fm.get(key):
                problems.append("%s: frontmatter is missing %s" % (where, key))
        unknown = sorted(set(fm) - ALLOWED_AGENT_KEYS)
        if unknown:
            problems.append("%s: frontmatter has unknown keys %s" % (where, ", ".join(unknown)))
        if fm.get("name") and fm["name"] != name:
            problems.append("%s: name %r must equal the file name %r" % (where, fm["name"], name))
        model = fm.get("model")
        if model and model not in MODELS and not str(model).startswith("claude-"):
            problems.append("%s: model %r is not one of %s or a full model id" % (where, model, sorted(MODELS)))
        effort = fm.get("effort")
        if effort and effort not in EFFORTS:
            problems.append("%s: effort %r is not one of %s" % (where, effort, sorted(EFFORTS)))
        if "maxTurns" in fm and (not isinstance(fm["maxTurns"], int) or fm["maxTurns"] < 1):
            problems.append("%s: maxTurns must be a positive integer" % where)
        declared = fm.get("skills") or []
        if isinstance(declared, str):
            declared = [declared]
        for skill in declared:
            if skill not in skills:
                problems.append("%s: skill %r has no skills/%s/ folder" % (where, skill, skill))
        if not body.strip():
            problems.append("%s: empty body" % where)


def check_skills(root, problems):
    for name in skill_names(root):
        sdir = os.path.join(root, "skills", name)
        where = "skills/%s" % name
        skill_md = os.path.join(sdir, "SKILL.md")
        if not os.path.isfile(skill_md):
            problems.append("%s: missing SKILL.md" % where)
        else:
            try:
                fm, _ = fmlib.read(skill_md)
                if fm.get("name") != name:
                    problems.append("%s/SKILL.md: name %r must equal the folder name" % (where, fm.get("name")))
                if not fm.get("description"):
                    problems.append("%s/SKILL.md: frontmatter is missing description" % where)
            except (fmlib.FrontmatterError, UnicodeDecodeError) as exc:
                problems.append("%s/SKILL.md: %s" % (where, exc))
        if not os.path.isfile(os.path.join(sdir, "CHANGELOG.md")):
            problems.append("%s: missing CHANGELOG.md" % where)


# ---------------------------------------------------------------- registry

def _contract_refs(role):
    refs = []
    if role.get("contract"):
        refs.append(role["contract"])
    for ref in (role.get("contracts") or {}).values():
        if ref:
            refs.append(ref)
    return refs


def check_registry(root, problems):
    path = os.path.join(root, "registry", "roles.json")
    if not os.path.isfile(path):
        problems.append("registry/roles.json: missing")
        return
    try:
        reg = load_json(path)
    except ValueError:
        return
    where = "registry/roles.json"
    agents = set(agent_names(root))
    skills = set(skill_names(root))
    classes = set((reg.get("computeClasses") or {}).keys())
    roles = reg.get("roles") or {}
    referenced_agents = set()
    for role_name, role in sorted(roles.items()):
        rw = "%s: role %s" % (where, role_name)
        agent = role.get("agent", "")
        if not agent.startswith("shipyard:"):
            problems.append("%s: agent %r must be shipyard:<name>" % (rw, agent))
        else:
            short = agent.split(":", 1)[1]
            referenced_agents.add(short)
            if short not in agents:
                problems.append("%s: agent %s has no agents/%s.md" % (rw, agent, short))
        modes = role.get("modes") or {}
        if not modes:
            problems.append("%s: no modes" % rw)
        for mode, cls in sorted(modes.items()):
            if cls not in classes:
                problems.append("%s: mode %s uses unknown compute class %r" % (rw, mode, cls))
        for skill in role.get("skills") or []:
            if skill not in skills:
                problems.append("%s: skill %r has no skills/%s/ folder" % (rw, skill, skill))
        for mode in (role.get("contracts") or {}):
            if mode not in modes:
                problems.append("%s: contracts names unknown mode %s" % (rw, mode))
        for ref in _contract_refs(role):
            stem, _, major = ref.partition("@")
            cpath = os.path.join(root, "contracts", stem + ".schema.json")
            if not os.path.isfile(cpath):
                problems.append("%s: contract %r has no contracts/%s.schema.json" % (rw, ref, stem))
                continue
            try:
                version = str(load_json(cpath).get("x-contract-version", ""))
            except ValueError:
                continue
            if major and version.split(".")[0] != major:
                problems.append("%s: contract %r but contracts/%s.schema.json is version %s"
                                % (rw, ref, stem, version))
    routing = reg.get("routing") or {}
    triggers = set((routing.get("triggerDefinitions") or {}).keys()) | {"always"}
    for stage in ("slice", "plan"):
        for rule in routing.get(stage) or []:
            if rule.get("role") not in roles:
                problems.append("%s: routing.%s names unknown role %r" % (where, stage, rule.get("role")))
            for key in ("when", "unless"):
                for trig in rule.get(key) or []:
                    if trig not in triggers:
                        problems.append("%s: routing.%s role %s uses undefined trigger %r"
                                        % (where, stage, rule.get("role"), trig))
    for short in sorted(agents - referenced_agents):
        problems.append("%s: agents/%s.md is not referenced by any role" % (where, short))


# ---------------------------------------------------------------- workflows

def _strip_js_comments(src):
    src = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.DOTALL)
    return re.sub(r"(^|[^:\\])//[^\n]*", r"\1", src)


def check_workflows(root, problems):
    wdir = os.path.join(root, "workflows")
    if not os.path.isdir(wdir):
        return
    for name in sorted(os.listdir(wdir)):
        if not name.endswith(".js"):
            continue
        where = "workflows/" + name
        with open(os.path.join(wdir, name), encoding="utf-8") as fh:
            src = fh.read()
        if not src.lstrip("﻿").lstrip().startswith("export const meta"):
            problems.append("%s: must start with `export const meta`" % where)
        code = _strip_js_comments(src)
        for pattern, label in WORKFLOW_FORBIDDEN:
            m = pattern.search(code)
            if m:
                line = code.count("\n", 0, m.start()) + 1
                problems.append("%s:%d: uses %s (not allowed in workflow scripts)" % (where, line, label))


# ---------------------------------------------------------------- README hero diagram

def first_mermaid_block(text):
    m = re.search(r"^```mermaid[ \t]*\n(.*?)^```", text, re.DOTALL | re.MULTILINE)
    return m.group(1) if m else None


def _norm(text):
    return "\n".join(line.rstrip() for line in text.strip().splitlines())


def check_hero_diagram(root, problems):
    readme = os.path.join(root, "README.md")
    hero = os.path.join(root, "docs", "diagrams", "01-hero.mmd")
    if not (os.path.isfile(readme) and os.path.isfile(hero)):
        return
    with open(readme, encoding="utf-8") as fh:
        block = first_mermaid_block(fh.read())
    with open(hero, encoding="utf-8") as fh:
        mmd = fh.read()
    if block is None:
        problems.append("README.md: no ```mermaid block (expected the hero diagram)")
    elif _norm(block) != _norm(mmd):
        problems.append("README.md: first Mermaid block differs from docs/diagrams/01-hero.mmd; keep them identical")


# ---------------------------------------------------------------- banned words

def check_banned_words(root, problems):
    for path in walk_files(root):
        r = rel(root, path)
        if os.path.basename(path) in BANNED_SCAN_EXEMPT and os.path.dirname(r) == "":
            continue
        try:
            with open(path, "rb") as fh:
                data = fh.read()
        except OSError:
            continue
        if b"\x00" in data[:8192]:
            continue  # binary
        text = data.decode("utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), 1):
            for m in BANNED_RE.finditer(line):
                problems.append("%s:%d: banned word %r" % (r, lineno, m.group(1)))
        for m in BANNED_RE.finditer(r):
            problems.append("%s: banned word %r in the path" % (r, m.group(1)))


CHECKS = (check_json_files, check_contracts, check_agents, check_skills, check_registry, check_workflows,
          check_hero_diagram, check_banned_words)


def run_checks(root):
    problems = []
    for check in CHECKS:
        check(root, problems)
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description="Shipyard repository hygiene checks")
    parser.add_argument("--root", default=DEFAULT_ROOT, help="repository root (default: this script's repo)")
    args = parser.parse_args(argv)
    root = os.path.abspath(args.root)
    problems = run_checks(root)
    if problems:
        print("check.py: %d problem%s" % (len(problems), "" if len(problems) == 1 else "s"))
        for p in problems:
            print("  - " + p)
        return 1
    print("check.py: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
