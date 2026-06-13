---
name: react-patterns
description: React component and hooks conventions. Use when creating or editing React components, custom hooks, state management, or debugging re-render/effect issues. 日本語の依頼例:「Reactコンポーネント作って」「カスタムフック」「状態管理」「再レンダリングが多い」「useEffectの直し方」。
---

# React Patterns

## Components

- Function components only. One exported component per file; file name matches component name (`UserCard.tsx`).
- Named exports, not default exports (better refactoring/grep). Exceptions — files whose consumer requires a default export: framework route/layout/page files, config files (`*.config.ts`, `.storybook/*`), and Storybook CSF `meta`.
- Props: define `type Props = {...}` above the component. Destructure in the signature. No `React.FC`.
- Keep components small: if a component handles fetching + branching + layout + interaction, split it.
- Composition over configuration: prefer `children` / slot props over boolean prop explosions (`<Card header={...}>` beats `<Card showHeader hasBorder isCompact …>`).
- Lists: `key` must be a stable ID from the data, never the array index when items can reorder/insert/delete.

## State

- Colocate state with the component that uses it; lift only when actually shared.
- Derive, don't sync: if a value can be computed from props/state during render, compute it — do NOT mirror it into state with an effect.
- Group related state into one object or `useReducer` when fields update together.
- Context is for low-frequency global data (theme, locale, session). For frequently-changing shared state, use a dedicated store or lift state — context re-renders all consumers.

## Effects

`useEffect` is for synchronizing with external systems (DOM APIs, subscriptions, non-React widgets) — nothing else.

- NOT for: transforming data for render, handling user events, resetting state on prop change (use `key`), fetching in apps that have a framework loader / RSC / query library.
- Every effect: complete dependency array (no lint suppression) and a cleanup function if it subscribes, schedules, or fetches (AbortController).
- If an effect only calls `setState` from other state/props, it's a derived value or an event handler in disguise — remove it.

## Performance

- Measure before optimizing (React DevTools Profiler) — add memoization only after a profile shows a render cost the user can perceive (jank, input lag), never preemptively. A re-render that the profiler shows under a frame budget is not a problem.
- React Compiler is stable and recommended for production; check whether it's enabled (babel/framework config). With it on, do not hand-write `memo` / `useMemo` / `useCallback` — it handles them.
- Without the compiler: memoize only proven-hot paths; prefer restructuring (move state down, pass `children`) over memo wrappers.
- `useId` for generated IDs (SSR-safe). Never `Math.random()` in render.

## Errors & loading

- Error boundaries around feature roots (route level at minimum). Render a recovery UI, not a blank screen.
- Loading: prefer `Suspense` boundaries where the framework supports them over manual `isLoading` flags.

## Custom hooks

- Extract a hook when stateful logic is reused or a component's logic obscures its render. Name `useX`, return a stable, minimal API.
- A hook that takes 5+ params or returns 8 fields is a component or store in disguise — restructure.

## Events & forms

- Handler props named `onX`, internal handlers `handleX`.
- Prefer uncontrolled inputs + form submission (FormData / Server Actions / form libraries) for plain forms; controlled inputs only when you need per-keystroke logic.
