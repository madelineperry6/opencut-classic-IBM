# Web Editor Architecture

High-level map of how the major subsystems in `apps/web/` fit together.

```mermaid
graph TD
    %% ── Entry point ──────────────────────────────────────────────────────────
    subgraph Browser["Browser (Next.js)"]
        direction TB

        subgraph UI["UI Layer  (apps/web/src/)"]
            direction TB
            AP["Asset Panel\ncomponents/editor/panels/assets/"]
            TL["Timeline UI\ntimeline/components/"]
            PV["Preview / Canvas\npreview/ · canvas/"]
            PP["Properties Panel\ncomponents/editor/panels/properties/"]
        end

        subgraph Core["EditorCore singleton  (core/)"]
            direction LR
            MM["MediaManager"]
            TM["TimelineManager"]
            SM["ScenesManager"]
            PM["ProjectManager"]
            PBM["PlaybackManager"]
            RM["RendererManager"]
            CM["CommandManager\n(undo / redo stack)"]
            SEL["SelectionManager"]
            AUDIO["AudioManager"]
            SAVE["SaveManager"]
        end

        subgraph Cmds["Commands  (commands/)"]
            IC["InsertElementCommand"]
            OC["Other Commands\n(trim, move, delete…)"]
        end

        subgraph Storage["Browser Storage  (services/storage/)"]
            OPFS["OPFS\n(media blobs)"]
            IDB["IndexedDB\n(project JSON + metadata)"]
        end

        subgraph Renderer["Renderer  (services/renderer/)"]
            SB["SceneBuilder\nresolves elements → render nodes"]
            GR["GPU Renderer\ngpu-renderer.ts · wgpu via WASM"]
            CN["Canvas Renderer\ncanvas-renderer.ts · 2-D fallback"]
            NODES["Render Nodes\nvideo / image / text / sticker…"]
        end

        subgraph WASM["WASM Bridge  (wasm/ + opencut-wasm pkg)"]
            MT["MediaTime helpers\nmediaTime · mediaTimeFromSeconds…"]
            COMP["Compositor\nrust/crates/compositor"]
            EFFECTS["Effects\nrust/crates/effects"]
            MASKS["Masks\nrust/crates/masks"]
            TIMECRATE["Time\nrust/crates/time"]
        end

        subgraph Media["Media Pipeline  (media/)"]
            UFU["useFileUpload\n(drag-and-drop / file picker)"]
            PMA["processMediaAssets\n(mediabunny: fps, codec, thumb)"]
            UPT["showMediaUploadToast"]
        end
    end

    %% ── React ↔ Core wiring ──────────────────────────────────────────────────
    AP -->|"useEditor()"| Core
    TL -->|"useEditor()"| Core
    PV -->|"useEditor()"| Core
    PP -->|"useEditor()"| Core

    %% ── Media import flow ────────────────────────────────────────────────────
    AP --> UFU
    UFU --> PMA
    PMA -->|"processed assets"| UPT
    UPT -->|"editor.media.addMediaAsset()"| MM
    MM -->|"saveMediaAsset()"| OPFS
    MM -->|"ratchetFpsForImportedMedia()"| PM

    %% ── Add to timeline ──────────────────────────────────────────────────────
    AP -->|"buildElementFromMedia() +\neditor.timeline.insertElement()"| TM
    TM -->|"new InsertElementCommand()"| IC
    IC -->|"execute()"| CM
    CM -->|"updateTracks() → notify()"| TM

    %% ── Other mutations ──────────────────────────────────────────────────────
    TL -->|"trim / move / split…"| OC
    OC --> CM

    %% ── Persistence ──────────────────────────────────────────────────────────
    PM -->|"project JSON"| IDB
    SAVE -->|"auto-save on change"| IDB
    IDB -->|"loadProject()"| PM

    %% ── Playback / Rendering ─────────────────────────────────────────────────
    PBM -->|"current time"| RM
    RM --> SB
    SB --> NODES
    NODES --> GR
    NODES --> CN
    GR -->|"applyEffect()"| EFFECTS
    GR -->|"applyMask()"| MASKS
    GR -->|"compositor"| COMP
    GR -->|"draw frame to canvas"| PV

    %% ── Time math ────────────────────────────────────────────────────────────
    TM -.->|"MediaTime ticks"| MT
    IC -.->|"roundMediaTime()"| MT
    MT -.->|"WASM boundary"| TIMECRATE
```

## Layer summary

| Layer | Location | Responsibility |
|---|---|---|
| **UI** | `src/components/`, `src/timeline/components/`, `src/preview/` | Rendering panels, drag-and-drop, property controls |
| **EditorCore** | `src/core/` | Singleton that owns all manager instances; sole source of truth for editor state |
| **Commands** | `src/commands/` | Every undoable mutation — dispatched through `CommandManager` |
| **Media pipeline** | `src/media/` | File ingestion, codec detection via `mediabunny`, thumbnail generation |
| **Renderer** | `src/services/renderer/` | Builds a node tree from the active scene and draws frames via GPU or 2-D canvas |
| **Storage** | `src/services/storage/` | IndexedDB (project JSON) + OPFS (raw media blobs); versioned migrations |
| **WASM bridge** | `src/wasm/`, `opencut-wasm` pkg | TypeScript wrappers for `MediaTime` and Rust compositing/effects/masks |
| **Rust crates** | `rust/crates/` | GPU pipelines (wgpu), compositor, effects, masks, time math |

## Key invariants

- **`EditorCore` is a singleton.** All UI reads state through `useEditor()` which subscribes via `useSyncExternalStore`.
- **All mutations go through a `Command`.** The `CommandManager` maintains the undo/redo stack; never mutate manager state directly.
- **`MediaTime` is integer ticks, not seconds.** Construct only via helpers in `@/wasm` (`mediaTime`, `mediaTimeFromSeconds`, `roundMediaTime`).
- **Storage migrations are additive-only.** Never remove or rename persisted fields — only add new ones alongside the old.
- **First visual element triggers project setup.** `InsertElementCommand` auto-sets canvas size and FPS from the asset when the timeline is empty.
