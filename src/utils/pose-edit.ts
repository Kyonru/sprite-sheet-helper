import * as THREE from "three";
import type { BoneRemap } from "./bone-remap";
import type { BoneFrame, PoseBoneData } from "./mediapipe-to-bones";
import type { PoseFrame } from "./pose-to-animation";

const DEG2RAD = Math.PI / 180;

export type PoseCorrection = {
  rotX: number;
  rotY: number;
  rotZ: number;
  mirror: boolean;
};

export type PoseBoneOverride = {
  x: number;
  y: number;
  z: number;
};

export type PoseFrameOverrides = Record<string, PoseBoneOverride>;
export type PoseAllFrameOverrides = Record<number, PoseFrameOverrides>;

export type PoseEditDraft = {
  frames: PoseFrame[];
  correction: PoseCorrection;
  overrides: PoseAllFrameOverrides;
};

export const DEFAULT_POSE_CORRECTION: PoseCorrection = {
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  mirror: false,
};

export const POSE_MIRROR_PAIRS: [keyof BoneRemap, keyof BoneRemap][] = [
  ["leftShoulder", "rightShoulder"],
  ["leftArm", "rightArm"],
  ["leftForeArm", "rightForeArm"],
  ["leftUpLeg", "rightUpLeg"],
  ["leftLeg", "rightLeg"],
  ["leftFoot", "rightFoot"],
];

export const POSE_BONE_LABELS: Partial<Record<keyof BoneRemap, string>> = {
  spine: "Spine",
  spine1: "Spine 1",
  spine2: "Spine 2",
  neck: "Neck",
  head: "Head",
  leftShoulder: "L Clavicle",
  rightShoulder: "R Clavicle",
  leftArm: "L Upper Arm",
  rightArm: "R Upper Arm",
  leftForeArm: "L Forearm",
  rightForeArm: "R Forearm",
  leftUpLeg: "L Upper Leg",
  rightUpLeg: "R Upper Leg",
  leftLeg: "L Shin",
  rightLeg: "R Shin",
  leftFoot: "L Foot",
  rightFoot: "R Foot",
};

export const POSE_BONE_GROUPS: {
  label: string;
  keys: (keyof BoneRemap)[];
}[] = [
  { label: "Torso", keys: ["spine", "spine1", "spine2"] },
  { label: "Head", keys: ["neck", "head"] },
  {
    label: "Left Arm",
    keys: ["leftShoulder", "leftArm", "leftForeArm"],
  },
  {
    label: "Right Arm",
    keys: ["rightShoulder", "rightArm", "rightForeArm"],
  },
  { label: "Left Leg", keys: ["leftUpLeg", "leftLeg", "leftFoot"] },
  { label: "Right Leg", keys: ["rightUpLeg", "rightLeg", "rightFoot"] },
];

export function mirrorPoseQuaternion(q: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion(-q.x, q.y, -q.z, q.w).normalize();
}

export function applyPoseCorrection(
  pose: PoseBoneData,
  correction: PoseCorrection,
): PoseBoneData {
  const corrQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      correction.rotX * DEG2RAD,
      correction.rotY * DEG2RAD,
      correction.rotZ * DEG2RAD,
      "YXZ",
    ),
  );
  const hipsQuat = new THREE.Quaternion().multiplyQuaternions(
    corrQuat,
    pose.hips.quaternion,
  );

  let bones: BoneFrame[] = pose.bones;
  if (correction.mirror) {
    const byKey = new Map<string, BoneFrame>(
      pose.bones.map((bone) => [bone.boneKey, bone]),
    );
    const result = new Map(byKey);
    for (const [leftKey, rightKey] of POSE_MIRROR_PAIRS) {
      const leftBone = byKey.get(leftKey);
      const rightBone = byKey.get(rightKey);
      if (leftBone && rightBone) {
        result.set(leftKey, {
          ...leftBone,
          quaternion: mirrorPoseQuaternion(rightBone.quaternion),
        });
        result.set(rightKey, {
          ...rightBone,
          quaternion: mirrorPoseQuaternion(leftBone.quaternion),
        });
      }
    }
    bones = [...result.values()];
  }

  return {
    hips: { ...pose.hips, quaternion: hipsQuat },
    bones,
  };
}

export function eulerDegToQuaternion(euler: PoseBoneOverride): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(euler.x * DEG2RAD, euler.y * DEG2RAD, euler.z * DEG2RAD, "YXZ"),
  );
}

export function quaternionToEulerDeg(
  quaternion: THREE.Quaternion,
): PoseBoneOverride {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
  return {
    x: Math.round(euler.x / DEG2RAD),
    y: Math.round(euler.y / DEG2RAD),
    z: Math.round(euler.z / DEG2RAD),
  };
}

export function applyPoseBoneOverrides(
  pose: PoseBoneData,
  overrides: PoseFrameOverrides,
): PoseBoneData {
  if (Object.keys(overrides).length === 0) return pose;
  return {
    ...pose,
    bones: pose.bones.map((bone) => {
      const override = overrides[bone.boneKey];
      if (!override) return bone;
      return {
        ...bone,
        quaternion: eulerDegToQuaternion(override),
      };
    }),
  };
}

export function buildFinalPose(
  frame: PoseFrame,
  correction: PoseCorrection,
  overrides: PoseFrameOverrides,
): PoseBoneData {
  return applyPoseBoneOverrides(
    applyPoseCorrection(frame.data, correction),
    overrides,
  );
}

export function buildFinalPoseFrames(draft: PoseEditDraft): PoseFrame[] {
  return draft.frames.map((frame, index) => ({
    ...frame,
    data: buildFinalPose(
      frame,
      draft.correction,
      draft.overrides[index] ?? {},
    ),
  }));
}

export function normalisePoseTimes(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length === 0) return [];
  const offset = frames[0].time;
  return frames.map((frame) => ({ ...frame, time: frame.time - offset }));
}

function shiftOverridesAfterDelete(
  overrides: PoseAllFrameOverrides,
  deletedIndex: number,
): PoseAllFrameOverrides {
  const result: PoseAllFrameOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    const index = Number(key);
    if (index === deletedIndex) continue;
    result[index > deletedIndex ? index - 1 : index] = value;
  }
  return result;
}

export function deletePoseFrame(
  draft: PoseEditDraft,
  frameIndex: number,
): PoseEditDraft {
  return {
    ...draft,
    frames: normalisePoseTimes(
      draft.frames.filter((_, index) => index !== frameIndex),
    ),
    overrides: shiftOverridesAfterDelete(draft.overrides, frameIndex),
  };
}

export function trimPoseFramesBefore(
  draft: PoseEditDraft,
  frameIndex: number,
): PoseEditDraft {
  const overrides: PoseAllFrameOverrides = {};
  for (const [key, value] of Object.entries(draft.overrides)) {
    const index = Number(key);
    if (index >= frameIndex) overrides[index - frameIndex] = value;
  }
  return {
    ...draft,
    frames: normalisePoseTimes(draft.frames.slice(frameIndex)),
    overrides,
  };
}

export function trimPoseFramesAfter(
  draft: PoseEditDraft,
  frameIndex: number,
): PoseEditDraft {
  const overrides: PoseAllFrameOverrides = {};
  for (const [key, value] of Object.entries(draft.overrides)) {
    const index = Number(key);
    if (index <= frameIndex) overrides[index] = value;
  }
  return {
    ...draft,
    frames: normalisePoseTimes(draft.frames.slice(0, frameIndex + 1)),
    overrides,
  };
}

export function setPoseBoneOverride(
  overrides: PoseAllFrameOverrides,
  frameIndex: number,
  boneKey: string,
  value: PoseBoneOverride,
): PoseAllFrameOverrides {
  return {
    ...overrides,
    [frameIndex]: {
      ...(overrides[frameIndex] ?? {}),
      [boneKey]: value,
    },
  };
}

export function resetPoseBoneOverride(
  overrides: PoseAllFrameOverrides,
  frameIndex: number,
  boneKey: string,
): PoseAllFrameOverrides {
  const frameOverrides = { ...(overrides[frameIndex] ?? {}) };
  delete frameOverrides[boneKey];
  return { ...overrides, [frameIndex]: frameOverrides };
}

export function applyPoseBoneOverrideToAllFrames(
  overrides: PoseAllFrameOverrides,
  frames: PoseFrame[],
  sourceFrameIndex: number,
  boneKey: string,
): PoseAllFrameOverrides {
  const value = overrides[sourceFrameIndex]?.[boneKey];
  if (!value) return overrides;
  const next = { ...overrides };
  frames.forEach((_, index) => {
    next[index] = { ...(next[index] ?? {}), [boneKey]: value };
  });
  return next;
}

export function resetPoseFrameOverrides(
  overrides: PoseAllFrameOverrides,
  frameIndex: number,
): PoseAllFrameOverrides {
  return { ...overrides, [frameIndex]: {} };
}

export function copyPoseFrameOverrides(
  overrides: PoseAllFrameOverrides,
  frameIndex: number,
): PoseFrameOverrides {
  return { ...(overrides[frameIndex] ?? {}) };
}

export function pastePoseFrameOverrides(
  overrides: PoseAllFrameOverrides,
  frameIndex: number,
  copied: PoseFrameOverrides,
): PoseAllFrameOverrides {
  return { ...overrides, [frameIndex]: { ...copied } };
}

export function getPoseBoneEuler(
  frame: PoseFrame | undefined,
  correction: PoseCorrection,
  frameOverrides: PoseFrameOverrides,
  boneKey: string,
): PoseBoneOverride {
  const existing = frameOverrides[boneKey];
  if (existing) return existing;
  if (!frame) return { x: 0, y: 0, z: 0 };

  const corrected = applyPoseCorrection(frame.data, correction);
  const bone = corrected.bones.find((item) => item.boneKey === boneKey);
  return bone ? quaternionToEulerDeg(bone.quaternion) : { x: 0, y: 0, z: 0 };
}
