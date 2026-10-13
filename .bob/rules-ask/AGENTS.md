# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Navigating the Codebase

### `apps/web/src/` is not a standard Next.js layout
The `src/` folder is split into **feature modules** (e.g. `timeline/`, `media/`, `canvas/`, `effects/`), not by component type. Each feature module contains its own components, hooks, types, and utilities co-located together.

### `@/core` is the editor backbone, not a utility folder
`src/core/index.ts` exports `EditorCore` — a singleton that owns all managers (timeline, media, playback, scenes, project, etc.). The entry point for understanding any editor feature is the relevant manager class in `src/core/managers/`.

### `@/wasm` is a thin TypeScript wrapper, not WASM itself
`src/wasm/` re-exports from `opencut-wasm` (the npm-published WASM package built from `rust/wasm/`). It adds TypeScript branded types (notably `MediaTime`) on top of the raw WASM bindings. The actual Rust source is in `rust/crates/` and `rust/wasm/src/`.

### Time is in ticks, not seconds or frames
All timeline positions and durations are `MediaTime` (integer tick counts). `TICKS_PER_SECOND` is the conversion constant. Seconds and frames are derived; ticks are primary. This mirrors the Rust `MediaTime(i64)` type.

### Two separate AGENTS.md files exist inside the project
- `AGENTS.md` (repo root) — general project guidance
- `apps/web/src/services/storage/migrations/AGENTS.md` — migration-specific policy (additive-only rule)

### `mediabunny` is the video decoding library
Video metadata (fps, duration, codec, thumbnail) is extracted via the `mediabunny` npm package in `src/media/mediabunny.ts`, not via native browser APIs directly.

### Tests use Bun's test runner, not Jest or Vitest
Import from `bun:test`. Test files sit in `__tests__/` subdirectories next to source files. Run a single file with `bun test <path>` from the repo root.
