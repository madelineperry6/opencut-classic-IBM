# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Coding Rules

### Function signatures
**`opencut/prefer-object-params` is a hard ESLint error.** Every function/method with 2+ parameters must destructure a single object:
```ts
// ✅ correct
function foo({ a, b }: { a: string; b: number }) {}
// ❌ will fail lint
function foo(a: string, b: number) {}
```
Exceptions (not enforced): direct callbacks passed inline to call sites, inline option-object callbacks, and TypeScript type predicates.

### `MediaTime`
`MediaTime` is a branded `number` (ticks, not seconds). A bare `number` is **not** assignable to it. Always construct via:
- `mediaTime({ ticks })` — from a known integer tick count
- `mediaTimeFromSeconds({ seconds })` — converts and rounds inside WASM
- `roundMediaTime({ time })` — rounds a fractional number onto the tick lattice

All three are from `@/wasm`. Never cast a raw float to `MediaTime`.

### Commands pattern
All timeline/project mutations must go through a `Command` subclass in `src/commands/`. Commands:
- must implement `execute(): CommandResult | undefined`
- must implement `undo()` or let it throw
- are dispatched via `editor.command.execute({ command })`
- return a `CommandResult` with optional `selection` patch

Never mutate `EditorCore` manager state directly from UI code.

### `EditorCore` singleton
`EditorCore` is a singleton. Access it with `EditorCore.getInstance()` in non-React code, or `useEditor()` in components. Never call `new EditorCore()` — the constructor is private. `EditorCore.reset()` exists only for tests.

### State subscription
Manager state reaches React **only** through `useEditor`. Managers use a plain `Set<() => void>` listener pattern. If you add a new manager, wire it into `useEditor`'s `subscribeAll` in `src/editor/use-editor.ts`.

### Storage
Never read/write project or media data directly to IndexedDB. Use `storageService` from `src/services/storage/service.ts`. Storage migrations in `src/services/storage/migrations/` are **additive only** — never remove or rename persisted fields.

### Import alias
`@/` maps to `apps/web/src/`. Use it for all intra-app imports.

### Unsafe type assertions
`@typescript-eslint/no-unsafe-type-assertion` is an error. Avoid `as SomeType` on `unknown`/`any` values.
