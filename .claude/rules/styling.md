---
paths:
  - "**/*.module.css"
  - "**/*.css"
---

# Styling tripwire

You are editing CSS. Load the `css-modules` skill if it isn't loaded (and `design-system` when the file belongs to a shared UI component or the tokens file).

- Colors, spacing, radii, shadows, z-index come from design tokens: `var(--...)`. Raw values live only in the tokens file itself.
- No `!important` (except documented third-party overrides); no ad-hoc z-index numbers — use the token scale.
- Selectors stay flat: class selectors from the module, no descendant chains reaching into other components, no `:global` without a comment saying why.
- Check `prefers-reduced-motion` before adding animation/transition (see `motion`).
- If the visual change affects an existing story, expect VRT baselines to change — review them deliberately (`visual-regression`), don't rubber-stamp.
