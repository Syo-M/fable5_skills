#!/usr/bin/env bash
# Installer for the fable_skills rules into a consuming project.
# Replaces the error-prone manual `cp -r` (which creates .claude/.claude/ and
# clobbers an existing settings.json) with a merge-safe, versioned install.
#
#   ./install.sh /path/to/your-project [--force]
#
#   --force  overwrite files that already exist in the target (default: skip them)
#
# What it does:
#   1. Copies .claude/{skills,rules,agents,hooks,output-styles,workflows} file-by-file
#      (existing files are SKIPPED unless --force — your local edits survive updates)
#   2. settings.json: copies if absent, otherwise MERGES our hook entries into yours
#   3. CLAUDE.md: copies if absent, otherwise saves ours as CLAUDE.md.fable-skills to merge by hand
#   4. Ensures .claude/settings.local.json is gitignored
#   5. Stamps .claude/fable-skills-version (tag + commit) so audits know which rules govern
# It does NOT copy templates/ (CI gates, lint configs) — those are opt-in; see templates/README.md.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
FORCE=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE="--force" ;;
    -*) echo "error: unknown flag '$arg' (only --force is supported)" >&2; exit 1 ;;
    *)
      if [[ -n "$TARGET" ]]; then echo "error: multiple targets given ('$TARGET', '$arg')" >&2; exit 1; fi
      TARGET="$arg" ;;
  esac
done

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "usage: ./install.sh /path/to/your-project [--force]" >&2
  [[ -n "$TARGET" ]] && echo "error: '$TARGET' is not a directory" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$SRC" ]]; then
  echo "error: target is the rules repo itself" >&2
  exit 1
fi
command -v node >/dev/null || { echo "error: node is required (hooks + settings merge)" >&2; exit 1; }

copied=0; skipped=0; overwritten=0
copy_tree() {
  local dir="$1"
  local f rel dest
  [[ -d "$SRC/.claude/$dir" ]] || return 0
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    dest="$TARGET/$rel"
    mkdir -p "$(dirname "$dest")"
    if [[ -e "$dest" && "$FORCE" != "--force" ]]; then
      skipped=$((skipped + 1))
    elif [[ -e "$dest" ]]; then
      cp "$f" "$dest"; overwritten=$((overwritten + 1))
    else
      cp "$f" "$dest"; copied=$((copied + 1))
    fi
  done < <(find "$SRC/.claude/$dir" -type f -print0)
}

for dir in skills rules agents hooks output-styles workflows; do copy_tree "$dir"; done

# settings.json — copy or merge (never clobber)
if [[ ! -f "$TARGET/.claude/settings.json" ]]; then
  cp "$SRC/.claude/settings.json" "$TARGET/.claude/settings.json"
  echo "settings.json: installed"
else
  node "$SRC/scripts/merge-settings.mjs" "$TARGET/.claude/settings.json" "$SRC/.claude/settings.json"
fi

# CLAUDE.md — copy or save alongside for manual merge (never clobber)
if [[ ! -f "$TARGET/CLAUDE.md" ]]; then
  cp "$SRC/CLAUDE.md" "$TARGET/CLAUDE.md"
  echo "CLAUDE.md: installed"
else
  cp "$SRC/CLAUDE.md" "$TARGET/CLAUDE.md.fable-skills"
  echo "CLAUDE.md: already exists — ours saved as CLAUDE.md.fable-skills; merge the sections you want"
fi

# gitignore the personal settings override
if ! grep -qs '^\.claude/settings\.local\.json$' "$TARGET/.gitignore" 2>/dev/null; then
  echo '.claude/settings.local.json' >> "$TARGET/.gitignore"
  echo ".gitignore: added .claude/settings.local.json"
fi

# version stamp for auditability
VERSION="$(git -C "$SRC" describe --tags --always 2>/dev/null || echo unknown)"
printf 'source: https://github.com/Syo-M/fable5_skills\nversion: %s\ninstalled: %s\n' \
  "$VERSION" "$(date +%Y-%m-%d)" > "$TARGET/.claude/fable-skills-version"

echo
echo "done: $copied installed, $skipped skipped (already present), $overwritten overwritten — version $VERSION"
echo "next: review templates/README.md for the CI gates / lint configs (opt-in copy),"
echo "      and add project specifics (framework, commands) to CLAUDE.md."
