#!/usr/bin/env python3
"""Merge Shipyard's permission rules into a project's .claude/settings.json. Stdlib only.

    python3 scripts/install_settings.py [--project PATH] [--example PATH]
                                        [--test-command "npm test"]... [--dry-run]

It unions `settings.example.json`'s `permissions.allow` and `permissions.deny` into the project's
`.claude/settings.json`, never dropping or reordering the user's existing entries and never touching any
other key. Creating the file when absent. Idempotent: running it twice adds nothing the second time.

`--test-command` adds a project's own test runner to the allow-list. Bare words become a prefix rule:
`npm test` -> `Bash(npm test:*)`. A value that already names a tool (contains `(`) is used verbatim.

Exits 0 on success (including a clean dry-run), 1 on a usage or file error.
"""

import argparse
import json
import os
import sys

DEFAULT_EXAMPLE = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "settings.example.json"))


class SettingsError(Exception):
    """A problem we can report cleanly instead of a traceback."""


def test_command_rule(value):
    """Turn a user's test command into a permission rule.

    A value that already names a tool (has a parenthesis) is trusted as-is; a bare command line
    becomes a Bash prefix rule so arguments are covered.
    """
    value = value.strip()
    if not value:
        return None
    if "(" in value:
        return value
    return "Bash(%s:*)" % value


def _union(existing, incoming):
    """existing entries first, in order; then any incoming entry not already present. Returns (merged, added)."""
    merged = list(existing)
    seen = set(existing)
    added = []
    for item in incoming:
        if item not in seen:
            merged.append(item)
            seen.add(item)
            added.append(item)
    return merged, added


def merge_settings(existing, example, extra_allow=()):
    """Pure merge. Returns (merged_settings, summary) where summary = {"allow": [...], "deny": [...]}.

    `existing` and `example` are parsed JSON objects. Keys other than `permissions` are preserved from
    `existing`; `$schema` is adopted from `example` only when `existing` has none.
    """
    if not isinstance(existing, dict):
        raise SettingsError("existing settings must be a JSON object")
    if not isinstance(example, dict):
        raise SettingsError("example settings must be a JSON object")

    merged = dict(existing)
    if "$schema" not in merged and example.get("$schema"):
        merged["$schema"] = example["$schema"]

    ex_perms = example.get("permissions") or {}
    cur_perms = dict(merged.get("permissions") or {})

    want_allow = list(ex_perms.get("allow") or []) + [r for r in extra_allow if r]
    allow, added_allow = _union(cur_perms.get("allow") or [], want_allow)
    deny, added_deny = _union(cur_perms.get("deny") or [], ex_perms.get("deny") or [])

    if allow:
        cur_perms["allow"] = allow
    if deny:
        cur_perms["deny"] = deny
    merged["permissions"] = cur_perms

    return merged, {"allow": added_allow, "deny": added_deny}


def load_json_file(path, what):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise SettingsError("%s not found: %s" % (what, path))
    except ValueError as exc:
        raise SettingsError("%s is not valid JSON (%s): %s" % (what, exc, path))


def run(project_dir, example_path, test_commands, dry_run):
    example = load_json_file(example_path, "example settings")
    target = os.path.join(project_dir, ".claude", "settings.json")

    if os.path.exists(target):
        existing = load_json_file(target, "project settings")
    else:
        existing = {}

    extra_allow = [r for r in (test_command_rule(c) for c in test_commands) if r]
    merged, summary = merge_settings(existing, example, extra_allow)

    added = summary["allow"] + summary["deny"]
    rel = os.path.relpath(target, project_dir)
    if not added:
        print("%s already has every Shipyard rule. Nothing to change." % rel)
        return 0

    if dry_run:
        print("Would add %d rule(s) to %s:" % (len(added), rel))
    else:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(merged, fh, indent=2)
            fh.write("\n")
        print("Added %d rule(s) to %s:" % (len(added), rel))
    for rule in summary["allow"]:
        print("  allow  %s" % rule)
    for rule in summary["deny"]:
        print("  deny   %s" % rule)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Merge Shipyard permission rules into .claude/settings.json")
    parser.add_argument("--project", default=os.getcwd(), help="project root (default: current directory)")
    parser.add_argument("--example", default=DEFAULT_EXAMPLE, help="settings.example.json to merge from")
    parser.add_argument("--test-command", action="append", default=[], metavar="CMD",
                        help="a test command to allow, e.g. 'npm test' (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="show what would change, write nothing")
    args = parser.parse_args(argv)
    try:
        return run(os.path.abspath(args.project), os.path.abspath(args.example), args.test_command, args.dry_run)
    except SettingsError as exc:
        print("install_settings.py: %s" % exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
