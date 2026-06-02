import * as THREE from "three";

const EPSILON = 1e-5;

export interface PlaybackClipResult {
  clip: THREE.AnimationClip;
  generated: boolean;
}

export function getAnimationClipFps(
  clip: THREE.AnimationClip,
  fallback = 30,
): number {
  const firstTrack = clip.tracks[0];
  if (!firstTrack || firstTrack.times.length < 2) return fallback;
  const delta = firstTrack.times[1] - firstTrack.times[0];
  return delta > EPSILON ? 1 / delta : fallback;
}

export function buildPlaybackClip(
  clip: THREE.AnimationClip,
  trimStart = 0,
  trimEnd = clip.duration,
  fps = getAnimationClipFps(clip),
): PlaybackClipResult {
  const safeStart = Math.max(0, trimStart);
  const safeEnd = trimEnd > 0 ? Math.min(trimEnd, clip.duration) : clip.duration;
  const usesWholeClip =
    safeStart <= EPSILON && Math.abs(safeEnd - clip.duration) <= EPSILON;

  if (usesWholeClip || clip.duration <= EPSILON) {
    return { clip, generated: false };
  }

  const startFrame = Math.max(0, Math.round(safeStart * fps));
  const endFrame = Math.max(startFrame + 1, Math.round(safeEnd * fps));
  let generated = THREE.AnimationUtils.subclip(
    clip,
    `${clip.name}_trimmed`,
    startFrame,
    endFrame,
    fps,
  );

  if (generated.duration <= EPSILON || generated.tracks.length === 0) {
    generated = THREE.AnimationUtils.subclip(
      clip,
      `${clip.name}_trimmed`,
      startFrame,
      endFrame + 1,
      fps,
    );
  }

  if (generated.duration <= EPSILON || generated.tracks.length === 0) {
    return { clip, generated: false };
  }

  return { clip: generated, generated: true };
}
