# BOB_LOG.md

**IBM Bob Hackathon 2026 — Theme 1: Explore, Fix, and Build**
Session log: what we asked, what Bob did, and what we shipped.

---

## Step 1 — Orient: what is this repo?

**Prompt:** *"Explain what this project does, how the repo is organized, and which folders matter for the web editor. Keep it beginner-friendly."*

Bob read `README.md`, listed `apps/`, `rust/`, and `docs/`, then produced a plain-English breakdown:

- **OpenCut** is a browser-based, privacy-first video editor (open-source CapCut alternative). Videos never leave the device.
- The repo is a **monorepo**: `apps/web/` (Next.js UI), `apps/desktop/` (GPUI native app, WIP), `rust/` (all platform-agnostic logic compiled to WASM).
- The architectural rule from `AGENTS.md`: *`rust/` owns all non-UI logic. `apps/` are pure UI shells that call into it.*
- For the web editor, the folders that matter are `src/editor/`, `src/timeline/`, `src/media/`, `src/canvas/`, `src/preview/`, `src/commands/`, `src/core/`, and `src/services/`.

---

## Step 2 — Generate AGENTS.md (the /init task)

**Prompt:** *"Analyze this codebase and create an AGENTS.md file containing build/lint/test commands and code style guidelines."*

Bob read `package.json` (root + `apps/web`), `biome.json`, `eslint.config.mjs`, `eslint/rules/prefer-object-params.mjs`, a sample test file, and a dozen source files, then produced:

**[`AGENTS.md`](AGENTS.md)** — expanded with:
- Command table (`bun dev:web`, `bun test <file>`, `bun lint:web`, `bun build:wasm`)
- Bun test runner callout (not Jest/Vitest — uses `bun:test`)
- **`opencut/prefer-object-params`** — a custom ESLint rule enforced as an error: all functions with 2+ parameters must use a single destructured object. Bob found this by reading the custom rule source in `eslint/rules/`
- `MediaTime` — a branded integer type wrapping tick counts; can only be constructed via `@/wasm` helpers, never cast from a raw float
- Command pattern — all timeline mutations go through `Command` subclasses dispatched via `CommandManager`
- Full 7-step media → timeline flow (file-by-file)

**[`.bob/rules-agent/AGENTS.md`](.bob/rules-agent/AGENTS.md)** — coding rules for agent mode  
**[`.bob/rules-ask/AGENTS.md`](.bob/rules-ask/AGENTS.md)** — navigation context for ask mode  
**[`.bob/rules-plan/AGENTS.md`](.bob/rules-plan/AGENTS.md)** — architectural constraints for plan mode

---

## Step 3 — Fact-check a claim

**Prompt:** *"The README says `moon run web:dev` but AGENTS.md says `bun dev:web`. Which is correct?"*

Bob searched for `moon` in `README.md`, then searched for `moon.yml` and `.moon/` across the entire repo. Finding neither, it confirmed:

- **`moon run web:dev` is wrong** — Moon is not installed or configured anywhere in this repo.
- **`bun dev:web` is correct**, defined in root `package.json` as `turbo run dev --filter=@opencut/web`, which runs `next dev --turbopack` in `apps/web/`.

---

## Step 4 — Generate the architecture diagram

**Prompt:** *"Create a Mermaid architecture diagram of the web editor and save it to docs/architecture.md."*

Bob read the existing `docs/` files, then traced the import graph through `EditorCore`, all manager classes, the renderer service, and the WASM bridge to produce **[`docs/architecture.md`](docs/architecture.md)**:

- 7-layer Mermaid diagram (UI → EditorCore → Commands → Media pipeline → Renderer → Storage → WASM/Rust)
- 5 annotated data flows: React↔state wiring, media import, add-to-timeline, playback/rendering, persistence
- Key invariants listed as a self-contained reference

---

## Step 5 — Walk through a user flow

**Prompt:** *"Walk me through what happens when a user imports a video and adds it to the timeline. Which files are involved?"*

Bob traced the full call chain by reading each file in sequence:

```
useFileUpload (src/media/use-file-upload.ts)
  → processMediaAssets (src/media/processing.ts)
      → mediabunny  ← decodes fps, codec, thumbnail
  → editor.media.addMediaAsset (MediaManager)
      → storageService.saveMediaAsset  ← persists to OPFS/IndexedDB
      → project.ratchetFpsForImportedMedia
  ↓ (user clicks asset in panel)
assets.tsx (src/components/editor/panels/assets/views/assets.tsx)
  → buildElementFromMedia (src/timeline/element-utils.ts)
  → editor.timeline.insertElement
      → InsertElementCommand (src/commands/timeline/element/insert-element.ts)
          → resolveTrackPlacement / applyPlacement
          → editor.timeline.updateTracks → notify() → React re-render
          (if first visual element: also sets canvas size + FPS from asset)
```

---

## Step 6 — The 8-bug audit

**Prompt:** *"Find likely bugs or edge cases in the timeline code. Rank them by how easy they are to fix."*

Bob read `placement/resolve.ts`, `placement/overlap.ts`, `commands/timeline/element/move-elements.ts`, `commands/timeline/element/split-elements.ts`, `commands/timeline/element/update-elements.ts`, `core/managers/timeline-manager.ts`, `core/managers/scenes-manager.ts`, and `timeline/update-pipeline.ts`.

Eight bugs found, in order of fix difficulty:

| # | Severity | File | Bug |
|---|---|---|---|
| 1 | 🟢 Easy | `move-elements.ts` | `execute()` throws on bad input instead of returning `undefined` — skips the undo stack |
| 2 | 🟢 Easy | `scenes-manager.ts` + hooks | `getActiveScene()` throws on `null`; called without null guards in resize/drag/playhead hooks |
| 3 | 🟢 Easy | `timeline-manager.ts` | `pushHistory: false` calls `command.execute()` raw — discards the `CommandResult` selection patch |
| 4 | 🟡 Medium | `move-elements.ts` | `MoveElementCommand` trusts the caller's `newStartTime` with no overlap validation |
| 5 | 🟡 Medium | `apply.ts` | Audio track insert-index formula semantically wrong with zero overlay tracks |
| 6 | 🟡 Medium | `main-track.ts` | Gap left at start of main track after deleting the first element |
| 7 | 🔴 Hard | `split-elements.ts` | Splitting a retimed clip near its end produces a zero-duration right half |
| **8** | **🔴 Hard** | **`resolve.ts`** | **`explicit` placement strategy skips `canPlaceTimeSpansOnTrack` — silent overlap on overlay tracks** |

---

## Step 7 — Write the regression test for bug #8

**Prompt:** *"Write a bun:test test that reproduces bug #8."*

The test needed to call `resolveTrackPlacement` directly, but the module transitively imports `opencut-wasm` (a compiled WASM binary not present locally), causing Bun to hang. Bob solved this with `mock.module("opencut-wasm", ...)` + dynamic `await import("../resolve")` — registering the mock synchronously before any module evaluation.

**[`apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts`](apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts)**

Two cases:
1. **Bug case** — overlay track has an element at ticks 0–100; new element also requests ticks 0–100 via `explicit` strategy → expects `null` (rejected). **Fails before fix** because the explicit branch returns a non-null result.
2. **Control case** — same track, new element at ticks 100–150 (no overlap) → expects `{ kind: "existingTrack" }`. Passes before and after fix.

---

## Step 8 — Fix bug #8

**Prompt:** *"Fix bug #8. Follow AGENTS.md rules."*

**Change:** 4 lines added to [`apps/web/src/timeline/placement/resolve.ts`](apps/web/src/timeline/placement/resolve.ts) in the `explicit` branch, immediately after the track-type compatibility check:

```ts
if (!canPlaceTimeSpansOnTrack({ track, timeSpans })) {
    return null;
}
```

- `canPlaceTimeSpansOnTrack` was already imported at line 9 — zero new imports
- Single destructured-object call style — satisfies `prefer-object-params`
- Identical pattern to the `preferIndex` branch (lines 201–204) and `aboveSource` branch (lines 238–241)

After the fix, the regression test's bug case passes: `resolveTrackPlacement` returns `null` when the explicit target slot is occupied.

---

## Files changed

| File | What |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Generated + expanded — commands, style rules, patterns, flow |
| [`.bob/rules-agent/AGENTS.md`](.bob/rules-agent/AGENTS.md) | New — coding rules for agent mode |
| [`.bob/rules-ask/AGENTS.md`](.bob/rules-ask/AGENTS.md) | New — navigation context for ask mode |
| [`.bob/rules-plan/AGENTS.md`](.bob/rules-plan/AGENTS.md) | New — architectural constraints for plan mode |
| [`docs/architecture.md`](docs/architecture.md) | New — Mermaid diagram of all 7 layers + 5 data flows |
| [`apps/web/src/timeline/placement/resolve.ts`](apps/web/src/timeline/placement/resolve.ts) | Bug #8 fix — 4 lines |
| [`apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts`](apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts) | New — regression test for bug #8 |
| [`README.md`](README.md) | Hackathon section added at top |
| [`BOB_LOG.md`](BOB_LOG.md) | This file |

---

## How to reproduce everything

```bash
# Clone and install
git clone <this-repo>
bun install

# Run the web app
bun dev:web
# → http://localhost:3000

# Build WASM (required for tests)
bun run build:wasm

# Run the regression test
cd apps/web
bun test src/timeline/placement/__tests__/explicit-overlap.test.ts

# Lint
bun lint:web
```

---

*Built at the IBM Bob Hackathon 2026 — Theme 1: Explore, Fix, and Build.*
