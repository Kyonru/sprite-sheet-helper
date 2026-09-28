import * as THREE from "three";
import type { PoseBoneData } from "./mediapipe-to-bones";

export interface PoseFrame {
  time: number;
  data: PoseBoneData;
}

export const STILL_POSE_CLIP_DURATION = 0.1;

export function getPoseClipDuration(frames: PoseFrame[]): number {
  if (frames.length === 0) return 0;
  const duration = frames[frames.length - 1].time;
  return duration > 0 ? duration : STILL_POSE_CLIP_DURATION;
}

function getClipFrames(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length === 0) return frames;
  const duration = frames[frames.length - 1].time;
  if (duration > 0) return frames;

  return [
    { ...frames[0], time: 0 },
    { ...frames[0], time: STILL_POSE_CLIP_DURATION },
  ];
}

/**
 * Force sign continuity along a quaternion track, in place.
 *
 * `q` and `-q` are the same rotation, but a sign flip between consecutive
 * keyframes makes any interpolator take the long way round the 4-sphere. In a
 * baked clip that reads as a limb spinning through the body for a single
 * frame. Landmark-driven poses are solved per frame with no continuity
 * guarantee, so flips are ordinary rather than exceptional and have to be
 * removed before the track is handed to three.
 *
 * Operates on the flat [x,y,z,w,...] buffer a KeyframeTrack takes.
 *
 * @returns how many keyframes had to be negated, for diagnostics.
 */
export function enforceQuaternionContinuity(values: number[]): number {
  let flips = 0;
  for (let i = 4; i < values.length; i += 4) {
    const dot =
      values[i - 4] * values[i] +
      values[i - 3] * values[i + 1] +
      values[i - 2] * values[i + 2] +
      values[i - 1] * values[i + 3];
    if (dot < 0) {
      values[i] = -values[i];
      values[i + 1] = -values[i + 1];
      values[i + 2] = -values[i + 2];
      values[i + 3] = -values[i + 3];
      flips += 1;
    }
  }
  return flips;
}

export function buildAnimationClip(
  frames: PoseFrame[],
  name: string,
): THREE.AnimationClip {
  if (frames.length === 0) return new THREE.AnimationClip(name, 0, []);

  const clipFrames = getClipFrames(frames);
  const duration = getPoseClipDuration(frames);
  const times = clipFrames.map((f) => f.time);
  const hipsName = clipFrames[0].data.hips.boneName;

  const hipPositions = clipFrames.flatMap((f) => [f.data.hips.position.x, f.data.hips.position.y, f.data.hips.position.z]);
  const hipQuats = clipFrames.flatMap((f) => [f.data.hips.quaternion.x, f.data.hips.quaternion.y, f.data.hips.quaternion.z, f.data.hips.quaternion.w]);
  enforceQuaternionContinuity(hipQuats);

  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack(`${hipsName}.position`, times, hipPositions),
    new THREE.QuaternionKeyframeTrack(`${hipsName}.quaternion`, times, hipQuats),
  ];

  // Bone quaternions are already parent-local (read directly from bone.quaternion in the preview)
  const boneKeys = clipFrames[0].data.bones.map((b) => b.boneKey);
  const boneNames = clipFrames[0].data.bones.map((b) => b.boneName);

  for (let i = 0; i < boneKeys.length; i++) {
    const boneKey = boneKeys[i];
    const boneName = boneNames[i];

    const values = clipFrames.flatMap((f) => {
      const bone = f.data.bones.find((b) => b.boneKey === boneKey);
      const q = bone?.quaternion ?? new THREE.Quaternion();
      return [q.x, q.y, q.z, q.w];
    });
    enforceQuaternionContinuity(values);

    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));

    const firstPosition = clipFrames
      .flatMap((f) => f.data.bones.filter((b) => b.boneKey === boneKey))
      .find((bone) => bone.position)?.position;
    if (firstPosition) {
      const positionValues = clipFrames.flatMap((f) => {
        const bone = f.data.bones.find((b) => b.boneKey === boneKey);
        const position = bone?.position ?? firstPosition;
        return [position.x, position.y, position.z];
      });
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${boneName}.position`,
          times,
          positionValues,
        ),
      );
    }
  }

  return new THREE.AnimationClip(name, duration, tracks);
}
