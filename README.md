# OpenCut (Legacy)

This is the original OpenCut codebase. It's archived and no longer maintained.

The rewrite is happening at [opencut-app/opencut](https://github.com/opencut-app/opencut).

---

## IBM Bob Hackathon 2026: What We Built

**Theme 1 — Students / Early Career: Explore, Fix, and Build** · Full session log: [BOB_LOG.md](BOB_LOG.md)

> We used IBM Bob to take on OpenCut, an open-source browser video editor none of us had seen before. Bob's `/init` and Ask mode mapped the codebase, producing project rules, a traced media-to-timeline flow, and a Mermaid architecture diagram. Bob then audited the timeline and ranked eight potential bugs. Instead of trusting the list, we had Bob write a Bun test reproducing bug #8: clips dropped onto an overlay track could silently overlap. The test failed, proving the bug. Using Plan and Agent modes, we applied a four-line fix mirroring existing placement strategies, and the test now passes.

Youtube link : https://youtu.be/ca-CU8MOueo

**Tech stack:** IBM Bob IDE (Ask, Plan, Agent modes, `/init`) · Next.js · React · TypeScript · Rust/WASM · Bun test runner · ESLint · Turborepo · Docker Compose · GitHub

## Try it live in the cloud
1. Open: https://codespaces.new/madelineperry6/opencut-classic-IBM
2. In the terminal, run:
   curl -fsSL https://bun.sh/install | bash && source ~/.bashrc
   cd apps/web && cp .env.example .env.local && bun install && bun dev
3. Open the forwarded port 3000.
Run our test: bun test src/timeline/placement/__tests__/explicit-overlap.test.ts

### Improvements made

- **Fixed bug #8** — explicit timeline placement now rejects overlapping clips ([`resolve.ts`](apps/web/src/timeline/placement/resolve.ts))
- **Added regression test** — [`explicit-overlap.test.ts`](apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts) (2 pass, 0 fail)
- **Audited the timeline** — documented 8 ranked issues (see bug table below)
- **Added [`docs/architecture.md`](docs/architecture.md)** — Mermaid diagram of all 7 layers and 5 data flows
- **Expanded [`AGENTS.md`](AGENTS.md)** and Bob mode rules in [`.bob/`](.bob/)
- **Added [`BOB_LOG.md`](BOB_LOG.md)** — step-by-step session log

### How Bob helped us understand the codebase

- **`/init` (AGENTS.md generation)** — Bob read `package.json`, `biome.json`, `eslint.config.mjs`, and every key source file to produce [`AGENTS.md`](AGENTS.md) and three mode-specific rule files (`.bob/rules-*/AGENTS.md`) documenting build commands, the custom `prefer-object-params` ESLint rule, the `MediaTime` branded-integer invariant, the Command pattern, and the full 7-step media → timeline flow.
- **Ask mode** — Used to answer questions about project structure, verify which commands actually start the app (confirming `bun dev:web`, not the non-existent `moon run web:dev` claimed in an earlier draft), and explain how each folder relates to the others.
- **`docs/architecture.md`** — Bob generated a full [Mermaid architecture diagram](docs/architecture.md) mapping all 7 layers of the web editor (UI, EditorCore singleton, Commands, Media pipeline, Renderer, Storage, WASM bridge) and the 5 major data flows through the system.

### The 8-bug audit

Bob read the entire timeline subsystem — placement, commands, update pipeline, drag-drop controller, scene manager — and surfaced 8 real bugs ranked by fix difficulty:

| # | Severity | Location | Description |
|---|---|---|---|
| 1 | Easy | `move-elements.ts` | `execute()` throws instead of returning `undefined`, skipping the undo stack |
| 2 | Easy | `scenes-manager.ts` | `getActiveScene()` throws; hooks call it without null guards |
| 3 | Easy | `timeline-manager.ts` | `pushHistory: false` bypasses `CommandManager`, silently drops selection updates |
| 4 | Medium | `move-elements.ts` | `MoveElementCommand` doesn't validate overlap before committing |
| 5 | Medium | `apply.ts` | Audio track insert-index formula wrong when there are no overlay tracks |
| 6 | Medium | `main-track.ts` | Main-track gap after deletion — only earliest element is re-anchored |
| 7 | Hard | `split-elements.ts` | Zero-duration half produced when a retimed clip is split near its end |
| **8** | **Hard** | **`resolve.ts`** | **Explicit placement strategy skips overlap check → silent clip overlap on overlay tracks** |

### Verifying bug #8 with a failing test

We wrote [`apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts`](apps/web/src/timeline/placement/__tests__/explicit-overlap.test.ts) — a `bun:test` regression test that calls `resolveTrackPlacement` with `strategy: { type: "explicit" }` targeting an overlay track that already has a clip in the same time slot, and asserts the result is `null` (rejected). Before the fix, the test fails because the explicit branch returns a non-null result and silently allows the overlap.

### The fix

**4 lines in [`apps/web/src/timeline/placement/resolve.ts`](apps/web/src/timeline/placement/resolve.ts)** — add the same `canPlaceTimeSpansOnTrack` guard that the `firstAvailable`, `preferIndex`, and `aboveSource` strategies already use:

```ts
if (!canPlaceTimeSpansOnTrack({ track, timeSpans })) {
    return null;
}
```

`canPlaceTimeSpansOnTrack` was already imported; no new dependencies were added.

### Running the app and the test

```bash
# Start the web app (from repo root)
bun install
bun dev:web
# → http://localhost:3000

# Run just the regression test (requires WASM to be built first)
bun run build:wasm
cd apps/web
bun test src/timeline/placement/__tests__/explicit-overlap.test.ts
```

---

## Sponsors

Thanks to [Vercel](https://vercel.com?utm_source=github-opencut&utm_campaign=oss) and [fal.ai](https://fal.ai?utm_source=github-opencut&utm_campaign=oss) for their support of open-source software.

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

<a href="https://fal.ai">
  <img alt="Powered by fal.ai" src="https://img.shields.io/badge/Powered%20by-fal.ai-000000?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCAxMEwxMy4wOSAxNS43NEwxMiAyMkwxMC45MSAxNS43NEw0IDEwTDEwLjkxIDguMjZMMTIgMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=" />
</a>

## Why?

- **Privacy**: Your videos stay on your device
- **Free features**: Most basic CapCut features are now paywalled 
- **Simple**: People want editors that are easy to use - CapCut proved that

## Project Structure

- `apps/web/`: Next.js web application
- `apps/desktop/`: Native desktop app built with GPUI (in progress)
- `rust/`: Platform-agnostic core: GPU compositor, effects, masks, and WASM bindings. We're actively migrating business logic here from TypeScript.
- `docs/`: Architecture and subsystem documentation

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation)
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

> **Note:** Docker is optional but recommended for running the local database and Redis. If you only want to work on frontend features, you can skip it.

### Setup

1. Fork and clone the repository

2. Copy the environment file:

   ```bash
   # Unix/Linux/Mac
   cp apps/web/.env.example apps/web/.env.local

   # Windows PowerShell
   Copy-Item apps/web/.env.example apps/web/.env.local
   ```

3. Start the database and Redis:

   ```bash
   docker compose up -d db redis serverless-redis-http
   ```

4. Install dependencies and start the dev server:

   ```bash
   bun install
   bun dev:web
   ```

The application will be available at [http://localhost:3000](http://localhost:3000).

The `.env.example` has sensible defaults that match the Docker Compose config — it should work out of the box.

### Desktop setup

Desktop is opt-in. If you're only working on the web app, skip this entirely.

If you want to get ready for `apps/desktop`, see [`apps/desktop/README.md`](apps/desktop/README.md). It's a two-step setup: Rust toolchain first, then desktop native dependencies.

### Local WASM development

Only needed if you're editing `rust/wasm` and want the web app to use your local build instead of the published package.

**Prerequisites** — install these once before anything else:

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# build the WASM package
cargo install wasm-pack

# reruns the build on file changes, used by bun dev:wasm
cargo install cargo-watch
```

1. Build the package once from the repo root:

   ```bash
   bun run build:wasm
   ```

2. Register the generated package for linking:

   ```bash
   cd rust/wasm/pkg
   bun link
   ```

3. Link `apps/web` to the local package:

   ```bash
   cd apps/web
   bun link opencut-wasm
   ```

4. Rebuild on changes while you work:

   ```bash
   bun dev:wasm
   ```

To switch `apps/web` back to the published package, run:

```bash
cd apps/web
bun add opencut-wasm
```

### Self-Hosting with Docker

To run everything (including a production build of the app) in Docker:

```bash
docker compose up -d
```

The app will be available at [http://localhost:3100](http://localhost:3100).

## Contributing

We welcome contributions! While we're actively developing and refactoring certain areas, there are plenty of opportunities to contribute effectively.

**🎯 Focus areas:** Timeline functionality, project management, performance, bug fixes, and UI improvements outside the preview panel.

**⚠️ Avoid for now:** Preview panel enhancements (fonts, stickers, effects) and export functionality - we're refactoring these with a new binary rendering approach.

See our [Contributing Guide](.github/CONTRIBUTING.md) for detailed setup instructions, development guidelines, and complete focus area guidance.

**Quick start for contributors:**

- Fork the repo and clone locally
- Follow the setup instructions in CONTRIBUTING.md
- Working on `apps/desktop`? See [`apps/desktop/README.md`](apps/desktop/README.md) for setup
- Create a feature branch and submit a PR

## License

[MIT LICENSE](LICENSE)

---

![Star History Chart](https://api.star-history.com/svg?repos=opencut-app/opencut&type=Date)

