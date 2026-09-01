import { describe, expect, it } from "vitest";
import {
  captureExceedsClip,
  getCaptureCycleSeconds,
  getClipFrameCount,
  wrapCaptureTime,
} from "@/utils/capture-timing";

describe("capture cycle length", () => {
  it("is the clip duration when nothing modifies it", () => {
    expect(getCaptureCycleSeconds({ duration: 0.967 })).toBeCloseTo(0.967, 6);
  });

  it("shortens with the trim range", () => {
    expect(getCaptureCycleSeconds({ duration: 2, trim: [0.5, 1.5] })).toBe(1);
  });

  it("scales with playback speed", () => {
    expect(getCaptureCycleSeconds({ duration: 2, speed: 2 })).toBe(1);
    expect(getCaptureCycleSeconds({ duration: 2, speed: 0.5 })).toBe(4);
  });

  it("ignores a trim range that is empty or inverted", () => {
    expect(getCaptureCycleSeconds({ duration: 2, trim: [1, 1] })).toBe(2);
    expect(getCaptureCycleSeconds({ duration: 2, trim: [1.5, 0.5] })).toBe(2);
  });

  it.each([0, -1, Number.NaN])("is zero for a duration of %s", (duration) => {
    expect(getCaptureCycleSeconds({ duration })).toBe(0);
  });
});

describe("frames per clip", () => {
  it("covers the clip exactly once", () => {
    expect(getClipFrameCount(1, 10)).toBe(10);
    expect(getClipFrameCount(0.967, 10)).toBe(10);
    expect(getClipFrameCount(2.5, 24)).toBe(60);
  });

  it("gives a one-pose clip a single frame", () => {
    // The bundled pose clips are 0.067s: at 10fps they are one frame, not the
    // eight identical ones the old default captured.
    expect(getClipFrameCount(0.067, 10)).toBe(1);
  });

  it.each([0, -1, Number.NaN])("falls back to one frame for %s", (value) => {
    expect(getClipFrameCount(value, 10)).toBe(1);
    expect(getClipFrameCount(1, value)).toBe(1);
  });
});

describe("wrapping capture time into the clip", () => {
  it("leaves times inside the cycle alone", () => {
    expect(wrapCaptureTime(0, 1)).toBe(0);
    expect(wrapCaptureTime(0.4, 1)).toBeCloseTo(0.4, 6);
  });

  it("wraps past the end instead of holding the last pose", () => {
    expect(wrapCaptureTime(1.2, 1)).toBeCloseTo(0.2, 6);
    expect(wrapCaptureTime(2.5, 1)).toBeCloseTo(0.5, 6);
  });

  it("leaves time alone when there is no cycle to wrap into", () => {
    // A static model: nothing to sample, and no reason to move the clock.
    expect(wrapCaptureTime(3, 0)).toBe(3);
  });
});

describe("detecting a capture that outruns its clip", () => {
  it("is quiet while the window fits", () => {
    expect(
      captureExceedsClip({ frameCount: 10, fps: 10, cycleSeconds: 0.967 }),
    ).toBe(false);
  });

  it("flags a window longer than the clip", () => {
    expect(
      captureExceedsClip({ frameCount: 20, fps: 10, cycleSeconds: 0.967 }),
    ).toBe(true);
    expect(
      captureExceedsClip({ frameCount: 8, fps: 10, cycleSeconds: 0.067 }),
    ).toBe(true);
  });

  it("says nothing about a model with no animation", () => {
    expect(
      captureExceedsClip({ frameCount: 30, fps: 10, cycleSeconds: 0 }),
    ).toBe(false);
  });
});
