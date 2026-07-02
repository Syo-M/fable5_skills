#!/usr/bin/env python3
"""CI check: every .claude markdown artifact has valid, complete frontmatter.
Requires PyYAML (pip install pyyaml). Run: python3 scripts/check_frontmatter.py
"""
import glob
import os
import re
import sys

import yaml

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
failed = 0


def fail(msg: str) -> None:
    global failed
    print(f"FAIL  {msg}")
    failed += 1


def load(path: str):
    src = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", src, re.S)
    if not m:
        fail(f"{path}: no frontmatter block")
        return None, ""
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        fail(f"{path}: YAML error: {e}")
        return None, ""
    if not isinstance(data, dict):
        fail(f"{path}: frontmatter is not a mapping")
        return None, ""
    return data, m.group(2)


def rel(p: str) -> str:
    return os.path.relpath(p, ROOT)


checked = 0

# Skills: name + description; description must carry Japanese trigger anchors.
for f in sorted(glob.glob(os.path.join(ROOT, ".claude/skills/*/SKILL.md"))):
    checked += 1
    data, body = load(f)
    if data is None:
        continue
    for key in ("name", "description"):
        if not data.get(key):
            fail(f"{rel(f)}: missing `{key}`")
    dirname = os.path.basename(os.path.dirname(f))
    if data.get("name") and data["name"] != dirname:
        fail(f"{rel(f)}: name `{data['name']}` != directory `{dirname}`")
    if data.get("description") and "日本語の依頼例" not in data["description"]:
        fail(f"{rel(f)}: description lacks the 日本語の依頼例 trigger anchors")
    if not body.strip():
        fail(f"{rel(f)}: empty body")

# Agents: name + description (+ valid memory scope, JP anchors).
for f in sorted(glob.glob(os.path.join(ROOT, ".claude/agents/*.md"))):
    checked += 1
    data, body = load(f)
    if data is None:
        continue
    for key in ("name", "description"):
        if not data.get(key):
            fail(f"{rel(f)}: missing `{key}`")
    if "memory" in data and data["memory"] not in ("user", "project", "local"):
        fail(f"{rel(f)}: memory must be `user`, `project`, or `local`, got `{data['memory']}`")
    if data.get("description") and "日本語の依頼例" not in data["description"]:
        fail(f"{rel(f)}: description lacks the 日本語の依頼例 trigger anchors")
    if not body.strip():
        fail(f"{rel(f)}: empty body")

# Rules: non-empty paths list of strings (path-scoped by design in this repo).
for f in sorted(glob.glob(os.path.join(ROOT, ".claude/rules/*.md"))):
    checked += 1
    data, body = load(f)
    if data is None:
        continue
    paths = data.get("paths")
    if not isinstance(paths, list) or not paths or not all(isinstance(p, str) and p for p in paths):
        fail(f"{rel(f)}: `paths` must be a non-empty list of glob strings (unscoped rules are banned here — use CLAUDE.md)")
    if not body.strip():
        fail(f"{rel(f)}: empty body")

# Output styles: name + description.
for f in sorted(glob.glob(os.path.join(ROOT, ".claude/output-styles/*.md"))):
    checked += 1
    data, body = load(f)
    if data is None:
        continue
    for key in ("name", "description"):
        if not data.get(key):
            fail(f"{rel(f)}: missing `{key}`")
    if not body.strip():
        fail(f"{rel(f)}: empty body")

if failed:
    print(f"\n{failed} frontmatter violation(s).")
    sys.exit(1)
print(f"OK  frontmatter: {checked} files valid (skills/agents/rules/output-styles)")
