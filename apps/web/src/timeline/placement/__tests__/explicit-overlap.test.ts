import { describe, expect, test } from "bun:test";
import type { OverlayTrack, SceneTracks, VideoTrack } from "@/timeline";
import { resolveTrackPlacement } from "@/timeline/placement";
import { mediaTime, ZERO_MEDIA_TIME } from "@/wasm";

// ── helpers (inline, self-contained) ────────────────────────────────────────

function buildVideoElement(id: string, startTime: number, duration: number) {
	return {
		id,
		type: "video" as const,
		name: id,
		startTime: mediaTime({ ticks: startTime }),
		duration: mediaTime({ ticks: duration }),
		trimStart: ZERO_MEDIA_TIME,
		trimEnd: ZERO_MEDIA_TIME,
		mediaId: `media-${id}`,
		params: {
			"transform.positionX": 0,
			"transform.positionY": 0,
			"transform.scaleX": 1,
			"transform.scaleY": 1,
			"transform.rotate": 0,
			opacity: 1,
		},
	};
}

function buildVideoTrack(id: string, elements: ReturnType<typeof buildVideoElement>[] = []): VideoTrack {
	return { id, type: "video", name: id, elements, muted: false, hidden: false };
}

function buildSceneTracks(overlay: OverlayTrack[] = [], mainElements: ReturnType<typeof buildVideoElement>[] = []): SceneTracks {
	return {
		overlay,
		main: buildVideoTrack("main", mainElements),
		audio: [],
	};
}

// ── bug #8: explicit strategy skips overlap check on overlay tracks ───────

describe("resolveTrackPlacement — explicit strategy", () => {
	test("returns null when the target overlay track already has an element at the same time", () => {
		// Existing element occupies ticks 0–100 on the overlay track.
		const existingElement = buildVideoElement("existing", 0, 100);
		const overlayTrack = buildVideoTrack("overlay-1", [existingElement]);
		const tracks = buildSceneTracks([overlayTrack as OverlayTrack]);

		// New element also wants ticks 0–100 on the same track — a direct overlap.
		const result = resolveTrackPlacement({
			tracks,
			elementType: "video",
			timeSpans: [
				{
					startTime: mediaTime({ ticks: 0 }),
					duration: mediaTime({ ticks: 100 }),
				},
			],
			strategy: { type: "explicit", trackId: "overlay-1" },
		});

		// Expected: placement should be rejected (null) because the slot is occupied.
		// Bug #8: the explicit strategy currently skips canPlaceTimeSpansOnTrack,
		// so it returns a non-null result instead of null, allowing silent overlap.
		expect(result).toBeNull();
	});
});
