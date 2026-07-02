#!/usr/bin/env bash
# Installer for the fable_skills rules into a consuming project.
# Replaces the error-prone manual `cp -r` (which creates .claude/.claude/ and
# clobbers an existing settings.json) with a merge-safe, versioned install.
#
#   ./install.sh /path/to/your-project [--styling css-modules|tailwind|minimal]
#                [--force] [--dry-run] [--check] [--no-import]
#
#   --styling    styling profile (default: css-modules). Swaps the styling skill/rule/
#                CLAUDE.md styling section; see profiles/<name>/profile.json
#   --force      overwrite files that already exist in the target (default: skip them)
#   --dry-run    print the full plan (install/skip/overwrite/merge/append) without changing anything
#   --check      report installed version vs this repo and how many files differ, then exit
#   --no-import  do not append the @CLAUDE.md.fable-skills import to an existing CLAUDE.md
#
# What it does:
#   1. Copies .claude/{skills,rules,agents,hooks,output-styles,workflows} file-by-file,
#      minus the chosen profile's excludes, plus its adds
#      (existing files are SKIPPED unless --force — your local edits survive updates)
#   2. settings.json: copies if absent, otherwise MERGES our hook entries into yours (idempotent)
#   3. CLAUDE.md: generated for the chosen profile (scripts/build-claude-md.mjs); copies if absent,
#      otherwise saves as CLAUDE.md.fable-skills AND appends an `@CLAUDE.md.fable-skills` import
#      (idempotent) so the resident core actually loads. Opt out with --no-import (warns).
#   4. Ensures .claude/settings.local.json and .claude/agent-memory-local/ are gitignored
#   5. Stamps .claude/fable-skills-version (tag + date + styling profile) for audits
# It does NOT copy templates/ (CI gates, lint configs) — those are opt-in; see templates/README.md.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
FORCE=""
DRYRUN=""
CHECK=""
NOIMPORT=""
STYLING="css-modules"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE="1"; shift ;;
    --dry-run) DRYRUN="1"; shift ;;
    --check) CHECK="1"; shift ;;
    --no-import) NOIMPORT="1"; shift ;;
    --styling)
      [[ $# -ge 2 ]] || { echo "error: --styling needs a value" >&2; exit 1; }
      STYLING="$2"; shift 2 ;;
    -*) echo "error: unknown flag '$1' (supported: --styling <name> --force --dry-run --check --no-import)" >&2; exit 1 ;;
    *)
      if [[ -n "$TARGET" ]]; then echo "error: multiple targets given ('$TARGET', '$1')" >&2; exit 1; fi
      TARGET="$1"; shift ;;
  esac
done

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "usage: ./install.sh /path/to/your-project [--styling <profile>] [--force] [--dry-run] [--check] [--no-import]" >&2
  [[ -n "$TARGET" ]] && echo "error: '$TARGET' is not a directory" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
if [[ "$TARGET" == "$SRC" ]]; then
  echo "error: target is the rules repo itself" >&2
  exit 1
fi
command -v node >/dev/null || { echo "error: node is required (hooks + settings merge)" >&2; exit 1; }
PROFILE_DIR="$SRC/profiles/$STYLING"
if [[ ! -f "$PROFILE_DIR/profile.json" ]]; then
  echo "error: unknown styling profile '$STYLING' — available: $(ls "$SRC/profiles")" >&2
  exit 1
fi
VERSION="$(git -C "$SRC" describe --tags --always --dirty 2>/dev/null || echo unknown)"

# profile excludes (repo-relative .claude/... paths), one per line
EXCLUDES="$(node -e "
const p=require('$PROFILE_DIR/profile.json');
const out=[];
for (const s of p.excludes.skills) out.push('.claude/skills/'+s);
for (const r of p.excludes.rules) out.push('.claude/rules/'+r);
console.log(out.join('\n'));
")"
# templates are opt-in manual copies — surface the profile's exclusions as guidance
TEMPLATE_EXCLUDES="$(node -e "
const p=require('$PROFILE_DIR/profile.json');
console.log((p.excludes.templates||[]).join(', '));
")"
is_excluded() {
  local rel="$1"
  while IFS= read -r ex; do
    [[ -z "$ex" ]] && continue
    [[ "$rel" == "$ex" || "$rel" == "$ex"/* ]] && return 0
  done <<< "$EXCLUDES"
  return 1
}

# ---------- --check: read-only status report (profile-aware via the stamp) ----------
if [[ -n "$CHECK" ]]; then
  echo "source repo version: $VERSION"
  if [[ -f "$TARGET/.claude/fable-skills-version" ]]; then
    echo "target install stamp:"
    sed 's/^/  /' "$TARGET/.claude/fable-skills-version"
    stamped="$(grep '^styling:' "$TARGET/.claude/fable-skills-version" | awk '{print $2}' || true)"
    if [[ -n "$stamped" && "$stamped" != "$STYLING" ]]; then
      echo "note: comparing with --styling $STYLING but the stamp says '$stamped' — pass --styling $stamped for an accurate diff"
    fi
  else
    echo "target install stamp: none (not installed via install.sh)"
  fi
  identical=0; differs=0; missing=0
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    is_excluded "$rel" && continue
    if [[ ! -e "$TARGET/$rel" ]]; then missing=$((missing + 1));
    elif cmp -s "$f" "$TARGET/$rel"; then identical=$((identical + 1));
    else differs=$((differs + 1)); fi
  done < <(find "$SRC/.claude/skills" "$SRC/.claude/rules" "$SRC/.claude/agents" "$SRC/.claude/hooks" \
                "$SRC/.claude/output-styles" "$SRC/.claude/workflows" -type f -print0 2>/dev/null)
  # profile adds are part of the contract too
  for kind in skills rules; do
    [[ -d "$PROFILE_DIR/$kind" ]] || continue
    while IFS= read -r -d '' f; do
      rel=".claude/$kind/${f#$PROFILE_DIR/$kind/}"
      if [[ ! -e "$TARGET/$rel" ]]; then missing=$((missing + 1));
      elif cmp -s "$f" "$TARGET/$rel"; then identical=$((identical + 1));
      else differs=$((differs + 1)); fi
    done < <(find "$PROFILE_DIR/$kind" -type f -print0)
  done
  echo "files vs this repo ($STYLING profile): $identical identical, $differs differ, $missing missing"
  echo "run without --check to install missing files (existing ones are skipped unless --force)"
  exit 0
fi

RUN="run"
[[ -n "$DRYRUN" ]] && RUN="plan" && echo "DRY RUN — nothing will be written"
echo "styling profile: $STYLING"

copied=0; skipped=0; overwritten=0
install_file() { # $1 = source file, $2 = repo-relative destination path
  local f="$1" rel="$2" dest
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
}

for dir in skills rules agents hooks output-styles workflows; do
  [[ -d "$SRC/.claude/$dir" ]] || continue
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    is_excluded "$rel" && continue
    install_file "$f" "$rel"
  done < <(find "$SRC/.claude/$dir" -type f -print0)
done

# profile adds: profiles/<name>/skills/** → .claude/skills/**, rules/** → .claude/rules/**
for kind in skills rules; do
  [[ -d "$PROFILE_DIR/$kind" ]] || continue
  while IFS= read -r -d '' f; do
    rel=".claude/$kind/${f#$PROFILE_DIR/$kind/}"
    install_file "$f" "$rel"
  done < <(find "$PROFILE_DIR/$kind" -type f -print0)
done

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

# CLAUDE.md — generated for the chosen profile; copy, or sidecar + @import
CLAUDE_TMP="$(mktemp)"
trap 'rm -f "$CLAUDE_TMP"' EXIT
node "$SRC/scripts/build-claude-md.mjs" --profile "$STYLING" --stdout > "$CLAUDE_TMP"
IMPORT_LINE="@CLAUDE.md.fable-skills"
if [[ ! -f "$TARGET/CLAUDE.md" ]]; then
  [[ -z "$DRYRUN" ]] && cp "$CLAUDE_TMP" "$TARGET/CLAUDE.md"
  echo "[$RUN] CLAUDE.md: install ($STYLING profile)"
else
  [[ -z "$DRYRUN" ]] && cp "$CLAUDE_TMP" "$TARGET/CLAUDE.md.fable-skills"
  echo "[$RUN] CLAUDE.md exists: save ours as CLAUDE.md.fable-skills ($STYLING profile)"
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

# version stamp for auditability — records SYNC STATE, not just the source version:
# a stamp alone must never imply "fully synchronized" when files were skipped or are missing.
if [[ -z "$DRYRUN" ]]; then
  s_ident=0; s_diff=0; s_miss=0
  while IFS= read -r -d '' f; do
    rel="${f#$SRC/}"
    is_excluded "$rel" && continue
    if [[ ! -e "$TARGET/$rel" ]]; then s_miss=$((s_miss + 1));
    elif cmp -s "$f" "$TARGET/$rel"; then s_ident=$((s_ident + 1));
    else s_diff=$((s_diff + 1)); fi
  done < <(find "$SRC/.claude/skills" "$SRC/.claude/rules" "$SRC/.claude/agents" "$SRC/.claude/hooks" \
                "$SRC/.claude/output-styles" "$SRC/.claude/workflows" -type f -print0 2>/dev/null)
  for kind in skills rules; do
    [[ -d "$PROFILE_DIR/$kind" ]] || continue
    while IFS= read -r -d '' f; do
      rel=".claude/$kind/${f#$PROFILE_DIR/$kind/}"
      if [[ ! -e "$TARGET/$rel" ]]; then s_miss=$((s_miss + 1));
      elif cmp -s "$f" "$TARGET/$rel"; then s_ident=$((s_ident + 1));
      else s_diff=$((s_diff + 1)); fi
    done < <(find "$PROFILE_DIR/$kind" -type f -print0)
  done
  # leftover detection: styling artifacts owned by OTHER profiles that are still
  # present in the target (e.g. the css-modules skill left behind after switching
  # to tailwind). A leftover means two styling rulebooks can fire — worse than a
  # local edit — so it gets its own state.
  LEFTOVERS="$(node -e "
    const fs=require('fs'), path=require('path');
    const profilesDir='$SRC/profiles', target='$TARGET', cur='$STYLING';
    const rel=(p)=>p; // already .claude-relative
    const ownedByCurrent=new Set();
    const all=new Set(['.claude/skills/css-modules','.claude/rules/styling.md']); // base styling artifacts
    for (const prof of fs.readdirSync(profilesDir)) {
      const pj=path.join(profilesDir,prof,'profile.json');
      if(!fs.existsSync(pj)) continue;
      const j=JSON.parse(fs.readFileSync(pj,'utf8'));
      const adds=[];
      for (const kind of ['skills','rules']) {
        const d=path.join(profilesDir,prof,kind);
        if(fs.existsSync(d)) for(const name of fs.readdirSync(d)) adds.push('.claude/'+kind+'/'+name);
      }
      adds.forEach(a=>all.add(a));
      if(prof===cur){ adds.forEach(a=>ownedByCurrent.add(a));
        // current profile also keeps base artifacts it does NOT exclude
        const ex=new Set([...(j.excludes.skills||[]).map(s=>'.claude/skills/'+s), ...(j.excludes.rules||[]).map(r=>'.claude/rules/'+r)]);
        for(const b of ['.claude/skills/css-modules','.claude/rules/styling.md']) if(!ex.has(b)) ownedByCurrent.add(b);
      }
    }
    const leftovers=[...all].filter(p=>!ownedByCurrent.has(p) && fs.existsSync(path.join(target,p)));
    console.log(leftovers.join('\n'));
  " 2>/dev/null)"
  s_extra=0
  [[ -n "$LEFTOVERS" ]] && s_extra=$(printf '%s\n' "$LEFTOVERS" | grep -c .)
  if [[ $s_extra -gt 0 ]]; then STATE="stale";
  elif [[ $s_miss -gt 0 ]]; then STATE="partial";
  elif [[ $s_diff -gt 0 ]]; then STATE="customized";
  else STATE="synchronized"; fi
  mkdir -p "$TARGET/.claude"
  printf 'source: https://github.com/Syo-M/fable5_skills\nversion: %s\nstyling: %s\nstate: %s\nidentical: %s\ndiffering: %s\nmissing: %s\nleftover: %s\ninstalled: %s\n' \
    "$VERSION" "$STYLING" "$STATE" "$s_ident" "$s_diff" "$s_miss" "$s_extra" "$(date +%Y-%m-%d)" > "$TARGET/.claude/fable-skills-version"
  if [[ "$STATE" == "stale" ]]; then
    echo "WARNING: state=stale — files from another styling profile remain and may fire alongside $STYLING:"
    printf '  %s\n' "$LEFTOVERS"
    echo "  remove them manually (a --migrate-profile helper is planned). See README「プロファイル切替」."
  elif [[ "$STATE" != "synchronized" ]]; then
    echo "note: state=$STATE ($s_diff differing, $s_miss missing) — the stamp version is the SOURCE version, not proof of full sync; see --check"
  fi
fi

echo
echo "$RUN result: $copied installed, $skipped skipped (already present), $overwritten overwritten — version $VERSION, styling $STYLING"
echo "next: review templates/README.md for the CI gates / lint configs (opt-in copy),"
if [[ -n "$TEMPLATE_EXCLUDES" ]]; then
  echo "      NOTE for the $STYLING profile: do NOT copy $TEMPLATE_EXCLUDES (it belongs to another styling profile),"
fi
echo "      and add project specifics (framework, commands) to CLAUDE.md."
