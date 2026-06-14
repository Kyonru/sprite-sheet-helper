import * as THREE from "three";

const EPSILON = 1e-5;

export interface PlaybackClipResult {
  clip: THREE.AnimationClip;
  generated: boolean;
}

export type InPlaceAxisMode =
  | "all"
  | "horizontal"
  | "x"
  | "y"
  | "z"
  | "none";

export type InPlaceAxisModeInput =
  | InPlaceAxisMode
  | "All XYZ"
  | "Horizontal XZ"
  | "Only X"
  | "Only Y"
  | "Only Z"
  | "None";

export const IN_PLACE_AXIS_OPTIONS: Record<string, InPlaceAxisMode> = {
  "All XYZ": "all",
  "Horizontal XZ": "horizontal",
  "Only X": "x",
  "Only Y": "y",
  "Only Z": "z",
  None: "none",
};

const originalClipCache = new Map<string, Map<string, THREE.AnimationClip>>();

function getFrozenAxisIndices(mode: InPlaceAxisMode): Array<0 | 1 | 2> {
  switch (mode) {
    case "horizontal":
      return [0, 2];
    case "x":
      return [0];
    case "y":
      return [1];
    case "z":
      return [2];
    case "none":
      return [];
    case "all":
    default:
      return [0, 1, 2];
  }
}

export function normalizeInPlaceAxisMode(
  value?: InPlaceAxisModeInput | string,
): InPlaceAxisMode {
  if (value === "Horizontal XZ" || value === "horizontal") {
    return "horizontal";
  }
  if (value === "Only X" || value === "x") return "x";
  if (value === "Only Y" || value === "y") return "y";
  if (value === "Only Z" || value === "z") return "z";
  if (value === "None" || value === "none") return "none";
  return "all";
}

export function makeInPlaceClip(
  clip: THREE.AnimationClip,
  inPlaceAxisMode: InPlaceAxisModeInput = "all",
): THREE.AnimationClip {
  const mode = normalizeInPlaceAxisMode(inPlaceAxisMode);
  const frozenAxisIndices = getFrozenAxisIndices(mode);

  if (frozenAxisIndices.length === 0) {
    return clip.clone();
  }

  const tracks = clip.tracks.map((track) => {
    if (!track.name.endsWith(".position")) {
      return track.clone();
    }

    const stride = track.getValueSize();
    if (stride !== 3) return track.clone();

    const values = Array.from(track.values);
    if (values.length < 3) return track.clone();

    const firstValues: [number, number, number] = [
      values[0] ?? 0,
      values[1] ?? 0,
      values[2] ?? 0,
    ];

    for (let offset = 0; offset < values.length; offset += 3) {
      for (const axisIndex of frozenAxisIndices) {
        values[offset + axisIndex] = firstValues[axisIndex];
      }
    }

    return new THREE.VectorKeyframeTrack(
      track.name,
      Array.from(track.times),
      values,
      track.getInterpolation(),
    );
  });

  const normalized = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  normalized.blendMode = clip.blendMode;
  return normalized;
}

export function rememberOriginalClip(
  modelUuid: string,
  clip: THREE.AnimationClip,
): void {
  let clipsByName = originalClipCache.get(modelUuid);
  if (!clipsByName) {
    clipsByName = new Map<string, THREE.AnimationClip>();
    originalClipCache.set(modelUuid, clipsByName);
  }

  if (!clipsByName.has(clip.name)) {
    clipsByName.set(clip.name, clip.clone());
  }
}

export function getOriginalClip(
  modelUuid: string,
  clipName: string,
): THREE.AnimationClip | null {
  return originalClipCache.get(modelUuid)?.get(clipName)?.clone() ?? null;
}

export function renameOriginalClip(
  modelUuid: string,
  fromName: string,
  toName: string,
): void {
  const clipsByName = originalClipCache.get(modelUuid);
  if (!clipsByName || fromName === toName) return;

  const clip = clipsByName.get(fromName);
  if (!clip) return;

  clipsByName.delete(fromName);
  const renamedClip = clip.clone();
  renamedClip.name = toName;
  clipsByName.set(toName, renamedClip);
}

export function clearOriginalClip(modelUuid: string): void {
  originalClipCache.delete(modelUuid);
}

export function clearAllOriginalClips(): void {
  originalClipCache.clear();
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
