---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/*.stories.*"
  - "**/e2e/**"
  - "**/playwright/**"
---

# Test-layer tripwire

You are editing tests. Pick the layer first, then load the matching skill:

- Pure logic → Vitest unit test (`testing-vitest`).
- Component behavior → Storybook story + play function (`storybook`) — NOT a plain Vitest component test.
- User journey across pages → Playwright E2E (`testing-playwright`), critical paths only.
- Visual appearance → VRT over existing stories (`visual-regression`) — never screenshot what a DOM assertion can check.

Cross-layer invariants:

- Query priority: `getByRole` with accessible name first; `data-testid` is the last resort and a hint the markup may lack semantics.
- No fixed sleeps (`waitForTimeout`, arbitrary `setTimeout`) — use web-first/auto-retrying assertions and fake timers.
- Mock at the network boundary with MSW, not by stubbing your own modules.
- A test that asserts nothing a user could observe (implementation details, internal state) is a candidate for deletion, not repair.
