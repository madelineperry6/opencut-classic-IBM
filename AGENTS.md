# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Architecture

An ongoing migration is moving all business logic into `rust/`. Each app under `apps/` is a UI shell — it owns rendering, interaction, and platform-specific concerns, but never owns logic. The UI framework for any given app is a replaceable detail.

### `rust/`

The single source of truth for all non-UI code. Everything platform-agnostic belongs here: no components, no hooks, no framework imports.

### `apps/`

Each app is a frontend that calls into Rust. Logic is never duplicated between apps — only UI is, because each platform may use an entirely different framework and language to build it.

- `web/` — Next.js
- `desktop/` — GPUI

## Web

### React

- Read components before using them. They may already apply classes, which affects what you need to pass and how to override them.

### Commands

Run all commands from the **repo root** unless otherwise stated.

| Task | Command |
|---|---|
| Dev server | `bun dev:web` |
| Build web | `bun build:web` |
| Run all tests | `bun test` |
| Run a single test file | `bun test apps/web/src/path/to/file.test.ts` |
| Lint web | `bun lint:web` |
| Lint + autofix | `bun lint:web:fix` |
| Build WASM | `bun build:wasm` |

Tests use **Bun's built-in test runner** (`bun:test`), not Jest/Vitest. Test files live next to their source (e.g. `src/timeline/__tests__/`).

### Code Style

- **Formatter**: Prettier with `useTabs: true`. Run `bun format:web` (scoped to `src/services/renderer`). Biome is also configured but with tabs + 80-char lines.
- **Custom ESLint rule `opencut/prefer-object-params`** (enforced as error): All functions with 2+ parameters must use a single destructured object. Exception: direct callbacks, inline option callbacks, and type predicates.
  - ✅ `function foo({ a, b }: { a: string; b: number }) {}`
  - ❌ `function foo(a: string, b: number) {}`
- `@typescript-eslint/no-unsafe-type-assertion` is an error — avoid unsafe `as` casts.
- Unused vars with `_` prefix are allowed.

### Key Patterns

- **`EditorCore` is a singleton** — access via `EditorCore.getInstance()` or `useEditor()` hook. Never instantiate directly; only one instance exists per session.
- **`useEditor(selector?)`** — React hook that subscribes to all manager stores via `useSyncExternalStore`. Pass a selector to avoid unnecessary renders.
- **`MediaTime` is a branded integer** (`number & { __mediaTime }`) that counts ticks, not seconds. Never construct from a raw fractional number — use `mediaTimeFromSeconds()`, `mediaTime({ ticks })`, or `roundMediaTime()` from `@/wasm`.
- **All mutations go through `Command` objects** (`src/commands/`). `Command.execute()` returns an optional `CommandResult` (selection patch). Commands must implement `undo()` or throw.
- **Managers notify React via a listener set** (not Zustand/Redux). Each manager has `subscribe(listener)` / `notify()`. Changes only reach React through `useEditor`.
- **Storage is browser-only** (IndexedDB + OPFS). `storageService` at `src/services/storage/service.ts` handles all persistence. Media files are stored as blobs keyed by project + asset id.

### Media Import → Timeline Flow

When a user drops or picks a video file, this chain runs:

1. **`useFileUpload`** (`src/media/use-file-upload.ts`) — collects `File[]`, blocks drop if a timeline drag is already active.
2. **`processMediaAssets`** (`src/media/processing.ts`) — calls `mediabunny` to decode metadata (duration, fps, codec, thumbnail). Warns if codec can't be decoded in browser.
3. **`editor.media.addMediaAsset`** (`MediaManager`) — assigns UUID, optimistically adds to in-memory list, then persists to `storageService`. Also calls `project.ratchetFpsForImportedMedia`.
4. **Asset panel** (`src/components/editor/panels/assets/views/assets.tsx`) — user double-clicks or drags asset onto timeline.
5. **`buildElementFromMedia`** (`src/timeline/element-utils.ts`) — constructs a `CreateTimelineElement` (type-switched: video/image/audio).
6. **`editor.timeline.insertElement`** → **`InsertElementCommand`** (`src/commands/timeline/element/insert-element.ts`) — resolves track placement, runs `applyPlacement`, calls `editor.timeline.updateTracks`. If it's the **first visual element**, also auto-sets canvas size and FPS from the asset.
7. Timeline re-renders because `updateTracks` calls `notify()` → `useEditor` subscribers update.

### Storage Migration Policy

See `src/services/storage/migrations/AGENTS.md`: migrations are **additive only** — never delete, rename, or replace persisted fields in a migration. Add new fields alongside old ones.
