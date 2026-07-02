#!/usr/bin/env bash
# Installer for the fable_skills rules into a consuming project.
# Replaces the error-prone manual `cp -r` (which creates .claude/.claude/ and
# clobbers an existing settings.json) with a merge-safe, versioned install.
#
#   ./install.sh /path/to/your-project [--force] [--dry-run] [--check] [--no-import]
#
#   --force      overwrite files that already exist in the target (default: skip them)
#   --dry-run    print the full plan (install/skip/overwrite/merge/append) without changing anything
#   --check      report installed version vs this repo and how many files differ, then exit
#   --no-import  do not append the @CLAUDE.md.fable-skills import to an existing CLAUDE.md
#
# What it does:
#   1. Copies .claude/{skills,rules,agents,hooks,output-styles,workflows} file-by-file
#      (existing files are SKIPPED unless --force — your local edits survive updates)
#   2. settings.json: copies if absent, otherwise MERGES our hook entries into yours (idempotent)
#   3. CLAUDE.md: copies if absent; otherwise saves ours as CLAUDE.md.fable-skills AND appends
#      an `@CLAUDE.md.fable-skills` import line to your CLAUDE.md (idempotent; official
#      @path import syntax) so the resident core actually loads — without this, the security
#      floor would silently not apply. Opt out with --no-import (a warning is printed instead).
#   4. Ensures .claude/settings.local.json and .claude/agent-memory-local/ are gitignored
#   5. Stamps .claude/fable-skills-version (tag + commit) so audits know which rules govern
# It does NOT copy templates/ (CI gates, lint configs) — those are opt-in; see templates/README.md.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
FORCE=""
DRYRUN=""
CHECK=""
NOIMPORT=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE="1" ;;
    --dry-run) DRYRUN="1" ;;
    --check) CHECK="1" ;;
    --no-import) NOIMPORT="1" ;;
    -*) echo "error: unknown flag '$arg' (supported: --force --dry-run --check --no-import)" >&2; exit 1 ;;
    *)
      if [[ -n "$TARGET" ]]; then echo "error: multiple targets given ('$TARGET', '$arg')" >&2; exit 1; fi
      TARGET="$arg" ;;
  esac
done

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "usage: ./install.sh /path/to/your-project [--force] [--dry-run] [--check] [--no-import]" >&2
  [[ -n "$TARGET" ]] && echo "error: '$TARGET' is not a directory" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$SRC" ]]; then
  echo "error: target is the rules repo itself" >&2
  exit 1
fi
command -v node >/dev/null || { echo "error: node is required (hooks + settings merge)" >&2; exit 1; }
VERSION="$(git -C "$SRC" describe --tags --always --dirty 2>/dev/null || echo unknown)"

# ---------- --check: read-only status report ----------
if [[ -n "$CHECK" ]]; then
  echo "source repo version: $VERSION"
  if [[ -f "$TARGET/.claude/fable-skills-version" ]]; then
    echo "target install stamp:"
    sed 's/^/  /' "$TARGET/.claude/fable-skills-version"
  else
    echo "target install stamp: none (not installed via install.sh)"
  fi
  identical=0; differs=0; missing=0
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    if [[ ! -e "$TARGET/$rel" ]]; then missing=$((missing + 1));
    elif cmp -s "$f" "$TARGET/$rel"; then identical=$((identical + 1));
    else differs=$((differs + 1)); fi
  done < <(find "$SRC/.claude/skills" "$SRC/.claude/rules" "$SRC/.claude/agents" "$SRC/.claude/hooks" \
                "$SRC/.claude/output-styles" "$SRC/.claude/workflows" -type f -print0 2>/dev/null)
  echo "files vs this repo: $identical identical, $differs differ (local edits or newer upstream), $missing missing"
  echo "run without --check to install missing files (existing ones are skipped unless --force)"
  exit 0
fi

RUN="run"
[[ -n "$DRYRUN" ]] && RUN="plan" && echo "DRY RUN — nothing will be written"

copied=0; skipped=0; overwritten=0
copy_tree() {
  local dir="$1"
  local f rel dest
  [[ -d "$SRC/.claude/$dir" ]] || return 0
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    dest="$TARGET/$rel"
    if [[ -e "$dest" && -z "$FORCE" ]]; then
      skipped=$((skipped + 1))
    elif [[ -e "$dest" ]]; then
      [[ -z "$DRYRUN" ]] && { mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; } || echo "[$RUN] overwrite: $rel"
      overwritten=$((overwritten + 1))
    else
      [[ -z "$DRYRUN" ]] && { mkdir -p "$(dirname "$dest")"; cp "$f" "$dest"; }
      copied=$((copied + 1))
    fi
  done < <(find "$SRC/.claude/$dir" -type f -print0)
}

for dir in skills rules agents hooks output-styles workflows; do copy_tree "$dir"; done

# settings.json — copy or merge (never clobber)
if [[ ! -f "$TARGET/.claude/settings.json" ]]; then
  if [[ -z "$DRYRUN" ]]; then
    mkdir -p "$TARGET/.claude"; cp "$SRC/.claude/settings.json" "$TARGET/.claude/settings.json"
  fi
  echo "[$RUN] settings.json: install"
else
  if [[ -z "$DRYRUN" ]]; then
    node "$SRC/scripts/merge-settings.mjs" "$TARGET/.claude/settings.json" "$SRC/.claude/settings.json"
  else
    echo "[$RUN] settings.json: merge our hook entries into existing (idempotent)"
  fi
fi

# CLAUDE.md — copy, or sidecar + @import so the resident core actually loads
IMPORT_LINE="@CLAUDE.md.fable-skills"
if [[ ! -f "$TARGET/CLAUDE.md" ]]; then
  [[ -z "$DRYRUN" ]] && cp "$SRC/CLAUDE.md" "$TARGET/CLAUDE.md"
  echo "[$RUN] CLAUDE.md: install"
else
  [[ -z "$DRYRUN" ]] && cp "$SRC/CLAUDE.md" "$TARGET/CLAUDE.md.fable-skills"
  echo "[$RUN] CLAUDE.md exists: save ours as CLAUDE.md.fable-skills"
  if [[ -n "$NOIMPORT" ]]; then
    echo ""
    echo "  WARNING: --no-import — the fable core (incl. the security floor) is NOT active yet."
    echo "  Merge CLAUDE.md.fable-skills manually, or add this line to your CLAUDE.md:"
    echo "    $IMPORT_LINE"
  elif grep -qsF "$IMPORT_LINE" "$TARGET/CLAUDE.md"; then
    echo "[$RUN] CLAUDE.md: import line already present (skip)"
  else
    if [[ -z "$DRYRUN" ]]; then
      printf '\n<!-- added by fable_skills install.sh — imports the rules core; remove after merging manually -->\n%s\n' \
        "$IMPORT_LINE" >> "$TARGET/CLAUDE.md"
    fi
    echo "[$RUN] CLAUDE.md: append '$IMPORT_LINE' (official @path import; remove after manual merge if preferred)"
  fi
fi

# gitignore: personal settings override + machine-local agent memory
for line in '.claude/settings.local.json' '.claude/agent-memory-local/'; do
  if ! grep -qsxF "$line" "$TARGET/.gitignore" 2>/dev/null; then
    [[ -z "$DRYRUN" ]] && echo "$line" >> "$TARGET/.gitignore"
    echo "[$RUN] .gitignore: add $line"
  fi
done

# version stamp for auditability
if [[ -z "$DRYRUN" ]]; then
  mkdir -p "$TARGET/.claude"
  printf 'source: https://github.com/Syo-M/fable5_skills\nversion: %s\ninstalled: %s\n' \
    "$VERSION" "$(date +%Y-%m-%d)" > "$TARGET/.claude/fable-skills-version"
fi

echo
echo "$RUN result: $copied installed, $skipped skipped (already present), $overwritten overwritten — version $VERSION"
echo "next: review templates/README.md for the CI gates / lint configs (opt-in copy),"
echo "      and add project specifics (framework, commands) to CLAUDE.md."
