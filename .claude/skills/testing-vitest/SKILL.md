---
name: testing-vitest
description: Vitest unit and component testing conventions — Testing Library, mocking policy, MSW, timers. Use when writing or fixing unit/component tests or vitest config.
---

# Vitest

## What to test, where

- Pure logic (utils, reducers, schema transforms) → plain unit tests. Fast, no DOM.
- Component behavior → Storybook play functions are the primary component-test layer (see `storybook` skill); write direct Testing Library tests only for headless hooks/providers with no visual states, or for prop-matrix edge cases too numerous to be stories.
- Full user flows → Playwright (see `testing-playwright`). Don't simulate routing/auth flows in jsdom.
- Test behavior users observe, not implementation: no asserting on state internals, no `container.querySelector('.styles_button_x')`, no spying on internal functions of the unit under test.

## Structure

- Colocate: `format.ts` + `format.test.ts`. Name tests as behavior sentences: `it('disables submit while the request is in flight')`.
- Arrange–Act–Assert, one behavior per test. Shared setup in a plain `setup()` factory function returning what tests need — avoid sprawling `beforeEach` mutation.
- No logic in tests (if/loops computing expectations). Expected values are literals.

## Testing Library rules

- Query priority (same list as `testing-playwright`): `getByRole` (with `name`) > `getByLabelText` > `getByText` > `getByTestId` (last resort, added deliberately). Never query by placeholder — a placeholder is not a label (see `a11y`); needing it means the input lacks one.
- All interactions via `userEvent` (`const user = userEvent.setup()`), never `fireEvent` — userEvent fires the full real event sequence.
- Async UI: `await screen.findByRole(...)` / `waitFor` for assertions only — never `waitFor` containing a user action, never arbitrary `setTimeout` sleeps.
- Wrap components needing providers with a shared `renderWithProviders` test util — one definition, not per-file copies.

## Mocking policy — mock at the boundary, not the module graph

- Network: **MSW** handlers, not `vi.mock`-ing your own fetch wrapper. Tests then survive refactors of the data layer.
- `vi.mock` only for true externals (analytics SDK, payment widget) and module-level non-determinism. If you're mocking your own module to make a test pass, the design or the test level is wrong.
- Non-determinism: `vi.useFakeTimers()` + `vi.setSystemTime()` for time; always `vi.useRealTimers()` in `afterEach`. With fake timers + userEvent, configure `advanceTimers: vi.advanceTimersByTime`.
- `vi.restoreAllMocks()` in `afterEach` (or `restoreMocks: true` in config) — leaked mocks cause order-dependent flake.

## Config

- Single source: define `test` in `vite.config.ts` (or merge it) so aliases/plugins match the app. `environment: 'jsdom'` only for DOM test projects; pure-logic tests run in `node` (faster) — use Vitest projects to split.
- Coverage is a signal, not a goal: review uncovered branches, don't chase a number with assertion-free tests.
- A test that fails intermittently is a bug to fix now (usually unawaited async or shared state) — never retry-loop or skip it.
