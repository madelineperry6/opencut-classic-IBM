# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Architectural Constraints

### UI is a shell — logic belongs in Rust
New platform-agnostic logic (compositing, effects, time math) must go in `rust/crates/`, not in TypeScript. TypeScript owns only rendering orchestration, UI state, and platform-specific concerns.

### EditorCore singleton owns all mutable state
There is exactly one `EditorCore` instance per session. All features interact with it through manager properties (`editor.timeline`, `editor.media`, etc.). Avoid component-local state for anything that needs to survive navigation or be shared across panels.

### Command pattern is mandatory for mutations with undo
Every user action that should be undoable must be a `Command` subclass. Commands save prior state in `execute()` and restore it in `undo()`. The `CommandManager` maintains the undo/redo stack. Bypassing this (mutating manager state directly) will silently break undo.

### Track auto-pruning is a reactor, not explicit cleanup
`EditorCore`'s constructor registers a **reactor** that automatically removes empty overlay and audio tracks after every command. Do not manually prune tracks elsewhere — the reactor handles it.

### First-element insertion has side effects on project settings
When the very first visual element is inserted into an empty timeline, `InsertElementCommand` auto-sets the project's canvas size and FPS to match the asset. Plan for this when writing features that insert elements programmatically.

### Storage schema is versioned and additive-only
The IndexedDB schema has 30+ migration versions. Any schema change requires a new migration file. Migrations must never delete or rename existing fields — only add new ones. Rollback is not supported (forward-only).

### `MediaTime` is not a float
Timeline layout, snapping, and export all assume tick-integer precision. Introducing fractional time values will cause subtle off-by-one frame bugs. Always go through the `@/wasm` helpers.

### `useEditor` must be the only React→state bridge
The manager stores use plain listener sets, not a reactive store library. React components must subscribe through `useEditor` only. Adding a second subscription mechanism would cause stale-render bugs.
