/**
 * Bug #8 regression test — explicit strategy skips the overlap check on overlay tracks.
 *
 * The placement modules transitively import opencut-wasm (a WASM binary) via
 * @/timeline/index.ts and @/wasm. We use Bun's mock.module() before any dynamic
 * import so the mock is in place before the WASM module is evaluated.
 *
 * All imports of resolved modules are done with `await import(...)` AFTER the mock
 * is registered, which is the correct pattern for Bun module mocking.
 */
import { mock, describe, expect, test } from "bun:test";

// Register the mock synchronously — this must happen before any `import` of
// a module that touches opencut-wasm.
mock.module("opencut-wasm", () => {
	const TICKS = 90000;
	return {
		TICKS_PER_SECOND: () => TICKS,
		mediaTimeFromSeconds: ({ seconds }: { seconds: number }) =>
			Math.round(seconds * TICKS),
		mediaTimeToSeconds: ({ time }: { time: number }) => time / TICKS,
		roundToFrame: ({ time }: { time: number }) => time,
		snappedSeekTime: ({ time }: { time: number }) => time,
		lastFrameTime: ({ duration }: { duration: number }) => duration,
		parseTimecode: () => null,
	};
});

// Helper: cast a plain number as MediaTime (branded number — safe at runtime).
const t = (n: number) => n as number & { readonly __mediaTime: unique symbol };

describe("resolveTrackPlacement — explicit strategy, bug #8", () => {
	test("rejects placement on an overlay track that already has an element at the same time", async () => {
		// Dynamic import AFTER mock is registered.
		const { resolveTrackPlacement } = await import("../resolve");

		// Overlay track with an element at ticks 0–100.
		const tracks = {
			overlay: [
				{
					id: "overlay-1",
					type: "video" as const,
					name: "overlay-1",
					muted: false,
					hidden: false,
					elements: [
						{
							id: "existing",
							type: "video" as const,
							name: "existing",
							startTime: t(0),
							duration: t(100),
							trimStart: t(0),
							trimEnd: t(0),
							mediaId: "media-existing",
							params: {
								"transform.positionX": 0,
								"transform.positionY": 0,
								"transform.scaleX": 1,
								"transform.scaleY": 1,
								"transform.rotate": 0,
								opacity: 1,
							},
						},
					],
				},
			],
			main: {
				id: "main",
				type: "video" as const,
				name: "main",
				muted: false,
				hidden: false,
				elements: [],
			},
			audio: [],
		};

		// Request explicit placement of a new element that overlaps ticks 0–100.
		const result = resolveTrackPlacement({
			tracks,
			elementType: "video",
			timeSpans: [{ startTime: t(0), duration: t(100) }],
			strategy: { type: "explicit", trackId: "overlay-1" },
		});

		// BUG #8: the explicit branch does NOT call canPlaceTimeSpansOnTrack,
		// so it currently returns a non-null result and silently allows the overlap.
		// When the bug is fixed, this assertion will pass.
		expect(result).toBeNull();
	});

	test("accepts placement on an overlay track when the time slot is free", async () => {
		const { resolveTrackPlacement } = await import("../resolve");

		// Same overlay track, but new element starts at tick 100 (no overlap).
		const tracks = {
			overlay: [
				{
					id: "overlay-1",
					type: "video" as const,
					name: "overlay-1",
					muted: false,
					hidden: false,
					elements: [
						{
							id: "existing",
							type: "video" as const,
							name: "existing",
							startTime: t(0),
							duration: t(100),
							trimStart: t(0),
							trimEnd: t(0),
							mediaId: "media-existing",
							params: {
								"transform.positionX": 0,
								"transform.positionY": 0,
								"transform.scaleX": 1,
								"transform.scaleY": 1,
								"transform.rotate": 0,
								opacity: 1,
							},
						},
					],
				},
			],
			main: {
				id: "main",
				type: "video" as const,
				name: "main",
				muted: false,
				hidden: false,
				elements: [],
			},
			audio: [],
		};

		const result = resolveTrackPlacement({
			tracks,
			elementType: "video",
			timeSpans: [{ startTime: t(100), duration: t(50) }],
			strategy: { type: "explicit", trackId: "overlay-1" },
		});

		// Non-overlapping placement: should be accepted.
		expect(result).not.toBeNull();
		expect(result?.kind).toBe("existingTrack");
	});
});
