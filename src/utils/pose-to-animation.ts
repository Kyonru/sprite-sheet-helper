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

    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));
  }

  return new THREE.AnimationClip(name, duration, tracks);
}
