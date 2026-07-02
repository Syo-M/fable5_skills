---
paths:
  - "**/*.css"
---

# Styling tripwire (tailwind profile)

You are editing CSS in a Tailwind project. Load the `tailwind` skill if it isn't loaded.

- `@theme` is the single source of truth for tokens — a raw value used twice belongs there, not
  inline in markup as an arbitrary value.
- Custom CSS goes in `@layer components` (or `@layer base` for element defaults) and consumes
  `@theme` tokens via `var(--…)`; unlayered CSS fights the cascade.
- Most styling belongs in markup as utilities — before writing custom CSS here, ask whether a
  component extraction or an `@theme` token solves it instead.
- Check `prefers-reduced-motion` before adding animation/transition (see `motion`).
- If the visual change affects an existing story, expect VRT baselines to change — review them
  deliberately (`visual-regression`), don't rubber-stamp.
