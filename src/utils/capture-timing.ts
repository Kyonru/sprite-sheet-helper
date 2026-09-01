/**
 * How capture time relates to the clip being captured.
 *
 * Capture seeks animation time directly, so these are the numbers that decide
 * which pose each frame holds: how long one cycle of the clip lasts once trims
 * and speed are applied, how many frames that cycle is worth at a given rate,
 * and where a frame index lands inside it.
 */

export type CaptureCycleInput = {
  /** The untrimmed clip length, in seconds. */
  duration: number;
  /** Trim range applied to the clip, in seconds. */
  trim?: [number, number];
  /** Playback speed multiplier. */
  speed?: number;
};

/**
 * The length of one cycle of a clip as it will be captured.
 *
 * Trimming shortens it and speed scales it, because both are applied to the
 * action before capture ever sees it — a 2s clip trimmed to its middle second
 * and played at 2× is half a second of capture.
 */
export function getCaptureCycleSeconds({
  duration,
  trim,
  speed = 1,
}: CaptureCycleInput): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;

  const [start, end] = trim ?? [0, duration];
  const trimmed =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? end - start
      : duration;
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;

  return trimmed / rate;
}

/**
 * How many frames one cycle is worth at a capture rate.
 *
 * This is the frame count that captures a clip exactly once: any more repeats
 * poses that are already in the sheet, any fewer drops the end of the motion. A
 * cycle too short to fill a single frame still gets one — a one-pose clip is a
 * one-frame sprite, not a zero-frame one.
 */
export function getClipFrameCount(cycleSeconds: number, fps: number): number {
  if (!Number.isFinite(cycleSeconds) || cycleSeconds <= 0) return 1;
  if (!Number.isFinite(fps) || fps <= 0) return 1;

  return Math.max(1, Math.round(cycleSeconds * fps));
}

/**
 * Where a capture time lands inside the clip.
 *
 * Past the end of the cycle it wraps, so asking for more frames than the clip
 * holds keeps sampling the motion instead of freezing on its last pose — which
 * is what a mixer does on its own, and what silently filled a third of an atlas
 * with duplicate frames. A cycle of zero (a static pose, or a model with no
 * animation at all) is left alone: there is nothing to wrap into.
 */
export function wrapCaptureTime(
  timeSeconds: number,
  cycleSeconds: number,
): number {
  if (!Number.isFinite(cycleSeconds) || cycleSeconds <= 0) return timeSeconds;
  if (!Number.isFinite(timeSeconds)) return 0;
  if (timeSeconds < cycleSeconds) return timeSeconds;

  const wrapped = timeSeconds % cycleSeconds;
  return wrapped < 0 ? wrapped + cycleSeconds : wrapped;
}

/**
 * Whether a capture would sample the same poses twice.
 *
 * True once the requested window runs past one cycle of the clip: the frames
 * beyond it repeat poses already captured, which is worth telling someone
 * before they spend atlas space on them.
 */
export function captureExceedsClip({
  frameCount,
  fps,
  cycleSeconds,
}: {
  frameCount: number;
  fps: number;
  cycleSeconds: number;
}): boolean {
  if (cycleSeconds <= 0) return false;
  return frameCount > getClipFrameCount(cycleSeconds, fps);
}
