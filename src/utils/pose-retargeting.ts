import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  BODY_PART_LABELS,
  type BoneRemap,
} from "./bone-remap";
import type { PoseBoneData } from "./mediapipe-to-bones";

const IDX = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

const REQUIRED_LANDMARKS = [
  ["nose", IDX.NOSE],
  ["left shoulder", IDX.LEFT_SHOULDER],
  ["right shoulder", IDX.RIGHT_SHOULDER],
  ["left elbow", IDX.LEFT_ELBOW],
  ["right elbow", IDX.RIGHT_ELBOW],
  ["left wrist", IDX.LEFT_WRIST],
  ["right wrist", IDX.RIGHT_WRIST],
  ["left hip", IDX.LEFT_HIP],
  ["right hip", IDX.RIGHT_HIP],
  ["left knee", IDX.LEFT_KNEE],
  ["right knee", IDX.RIGHT_KNEE],
  ["left ankle", IDX.LEFT_ANKLE],
  ["right ankle", IDX.RIGHT_ANKLE],
] as const;

const EXPECTED_CHILD_KEYS: Partial<
  Record<keyof BoneRemap, readonly (keyof BoneRemap)[]>
> = {
  hips: ["spine"],
  spine: ["spine1", "spine2", "neck"],
  spine1: ["spine2", "neck"],
  spine2: ["neck", "head"],
  neck: ["head"],
  leftShoulder: ["leftArm"],
  rightShoulder: ["rightArm"],
  leftArm: ["leftForeArm"],
  rightArm: ["rightForeArm"],
  leftUpLeg: ["leftLeg"],
  rightUpLeg: ["rightLeg"],
  leftLeg: ["leftFoot"],
  rightLeg: ["rightFoot"],
};

export const BONE_GROUPS: Record<string, readonly (keyof BoneRemap)[]> = {
  Torso: ["hips", "spine", "spine1", "spine2", "neck", "head"],
  "Left Arm": ["leftShoulder", "leftArm", "leftForeArm"],
  "Right Arm": ["rightShoulder", "rightArm", "rightForeArm"],
  "Left Leg": ["leftUpLeg", "leftLeg", "leftFoot"],
  "Right Leg": ["rightUpLeg", "rightLeg", "rightFoot"],
};

const ANATOMICAL_LIMITS_DEG: Partial<Record<keyof BoneRemap, number>> = {
  hips: 80,
  spine: 55,
  spine1: 55,
  spine2: 55,
  neck: 50,
  head: 55,
  leftShoulder: 75,
  rightShoulder: 75,
  leftArm: 145,
  rightArm: 145,
  leftForeArm: 155,
  rightForeArm: 155,
  leftUpLeg: 125,
  rightUpLeg: 125,
  leftLeg: 150,
  rightLeg: 150,
  leftFoot: 75,
  rightFoot: 75,
};

export type PoseQualityLabel = "Good" | "Usable" | "Poor";

export interface PoseQualityMetrics {
  visibility: number;
  coverage: number;
  inFrame: number;
  limbConsistency: number;
  depth: number;
  plausibility: number;
  mapping: number;
}

export interface PoseQualityResult {
  score: number;
  label: PoseQualityLabel;
  warnings: string[];
  missingRequired: string[];
  metrics: PoseQualityMetrics;
}

export interface PoseLandmarkInput {
  worldLandmarks?: NormalizedLandmark[] | null;
  screenLandmarks?: NormalizedLandmark[] | null;
  remap?: BoneRemap;
  availableBones?: readonly string[];
}

export interface PoseLandmarkCandidate {
  id?: string;
  label?: string;
  worldLandmarks?: NormalizedLandmark[] | null;
  screenLandmarks?: NormalizedLandmark[] | null;
}

export interface ScoredPoseCandidate<T extends PoseLandmarkCandidate> {
  candidate: T;
  quality: PoseQualityResult;
}

export interface RigRetargetBone {
  key: keyof BoneRemap;
  boneName: string;
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  restDir: THREE.Vector3;
  childKey?: keyof BoneRemap;
  childName?: string;
  child?: THREE.Object3D;
}

export interface RigRetargetMap {
  bones: Map<keyof BoneRemap, RigRetargetBone>;
  byName: Map<string, RigRetargetBone>;
}

export interface PoseBoneCalibration {
  boneKey: keyof BoneRemap;
  boneName: string;
  offset: THREE.Quaternion;
}

export interface PoseCalibration {
  createdAt: number;
  hips?: PoseBoneCalibration;
  bones: Partial<Record<keyof BoneRemap, PoseBoneCalibration>>;
}

export interface BoneMappingGroupStatus {
  name: string;
  mapped: number;
  total: number;
  missing: (keyof BoneRemap)[];
}

export interface BoneMappingAnalysis {
  mapped: number;
  total: number;
  score: number;
  missing: (keyof BoneRemap)[];
  duplicates: string[];
  suspicious: string[];
  groups: BoneMappingGroupStatus[];
  issues: string[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function visibilityOf(
  landmarks: NormalizedLandmark[] | null | undefined,
  index: number,
) {
  const landmark = landmarks?.[index];
  if (!landmark) return 0;
  const maybeWithPresence = landmark as NormalizedLandmark & {
    presence?: number;
  };
  return clamp01(landmark.visibility ?? maybeWithPresence.presence ?? 1);
}

function pointOf(landmarks: NormalizedLandmark[], index: number) {
  const point = landmarks[index];
  return new THREE.Vector3(point.x, point.y, point.z ?? 0);
}

function segmentLength(
  landmarks: NormalizedLandmark[] | null | undefined,
  a: number,
  b: number,
) {
  if (!landmarks?.[a] || !landmarks[b]) return 0;
  return pointOf(landmarks, a).distanceTo(pointOf(landmarks, b));
}

function pairedLengthScore(
  landmarks: NormalizedLandmark[] | null | undefined,
  leftA: number,
  leftB: number,
  rightA: number,
  rightB: number,
) {
  const left = segmentLength(landmarks, leftA, leftB);
  const right = segmentLength(landmarks, rightA, rightB);
  if (left < 1e-5 || right < 1e-5) return 0;
  return clamp01(Math.min(left, right) / Math.max(left, right));
}

function angleAt(
  landmarks: NormalizedLandmark[] | null | undefined,
  a: number,
  b: number,
  c: number,
) {
  if (!landmarks?.[a] || !landmarks[b] || !landmarks[c]) return null;
  const ba = pointOf(landmarks, a).sub(pointOf(landmarks, b));
  const bc = pointOf(landmarks, c).sub(pointOf(landmarks, b));
  if (ba.lengthSq() < 1e-8 || bc.lengthSq() < 1e-8) return null;
  return THREE.MathUtils.radToDeg(ba.angleTo(bc));
}

function anglePlausibility(angle: number | null) {
  if (angle === null || !Number.isFinite(angle)) return 0;
  if (angle < 4) return 0;
  if (angle < 10) return 0.45;
  if (angle > 179.5) return 0.65;
  return 1;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function scoreBodyInFrame(
  screenLandmarks: NormalizedLandmark[] | null | undefined,
) {
  if (!screenLandmarks || screenLandmarks.length < 33) return 1;

  const points = REQUIRED_LANDMARKS.map(([, index]) => screenLandmarks[index])
    .filter(Boolean);
  if (points.length === 0) return 0;

  const inside = points.filter(
    (point) =>
      point.x >= 0.02 &&
      point.x <= 0.98 &&
      point.y >= 0.02 &&
      point.y <= 0.98,
  ).length;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(width, height);
  const sizeScore = size >= 0.34 ? 1 : size >= 0.2 ? 0.7 : 0.35;

  return clamp01((inside / points.length) * 0.75 + sizeScore * 0.25);
}

function scoreDepth(landmarks: NormalizedLandmark[] | null | undefined) {
  if (!landmarks || landmarks.length < 33) return 0;
  const values = REQUIRED_LANDMARKS.map(([, index]) => landmarks[index]?.z)
    .filter((value): value is number => Number.isFinite(value));
  if (values.length < 4) return 0.5;
  const mid = median(values);
  const maxDeviation = Math.max(...values.map((value) => Math.abs(value - mid)));
  if (maxDeviation <= 0.75) return 1;
  if (maxDeviation <= 1.25) return 0.75;
  if (maxDeviation <= 2) return 0.45;
  return 0.15;
}

function scoreLimbConsistency(
  landmarks: NormalizedLandmark[] | null | undefined,
) {
  const scores = [
    pairedLengthScore(
      landmarks,
      IDX.LEFT_SHOULDER,
      IDX.LEFT_ELBOW,
      IDX.RIGHT_SHOULDER,
      IDX.RIGHT_ELBOW,
    ),
    pairedLengthScore(
      landmarks,
      IDX.LEFT_ELBOW,
      IDX.LEFT_WRIST,
      IDX.RIGHT_ELBOW,
      IDX.RIGHT_WRIST,
    ),
    pairedLengthScore(
      landmarks,
      IDX.LEFT_HIP,
      IDX.LEFT_KNEE,
      IDX.RIGHT_HIP,
      IDX.RIGHT_KNEE,
    ),
    pairedLengthScore(
      landmarks,
      IDX.LEFT_KNEE,
      IDX.LEFT_ANKLE,
      IDX.RIGHT_KNEE,
      IDX.RIGHT_ANKLE,
    ),
  ];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scorePlausibility(
  landmarks: NormalizedLandmark[] | null | undefined,
) {
  const scores = [
    anglePlausibility(
      angleAt(landmarks, IDX.LEFT_SHOULDER, IDX.LEFT_ELBOW, IDX.LEFT_WRIST),
    ),
    anglePlausibility(
      angleAt(landmarks, IDX.RIGHT_SHOULDER, IDX.RIGHT_ELBOW, IDX.RIGHT_WRIST),
    ),
    anglePlausibility(
      angleAt(landmarks, IDX.LEFT_HIP, IDX.LEFT_KNEE, IDX.LEFT_ANKLE),
    ),
    anglePlausibility(
      angleAt(landmarks, IDX.RIGHT_HIP, IDX.RIGHT_KNEE, IDX.RIGHT_ANKLE),
    ),
  ];
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function analyzeBoneMapping(
  remap: BoneRemap,
  availableBones: readonly string[] = [],
): BoneMappingAnalysis {
  const keys = Object.keys(BODY_PART_LABELS) as (keyof BoneRemap)[];
  const available = new Set(availableBones);
  const hasAvailableList = availableBones.length > 0;
  const missing = keys.filter((key) => {
    const boneName = remap[key];
    return !boneName || (hasAvailableList && !available.has(boneName));
  });
  const mapped = keys.length - missing.length;

  const counts = new Map<string, number>();
  keys.forEach((key) => {
    const boneName = remap[key];
    if (!boneName) return;
    counts.set(boneName, (counts.get(boneName) ?? 0) + 1);
  });
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([boneName]) => boneName);

  const suspicious = keys.flatMap((key) => {
    const boneName = remap[key];
    const lower = boneName.toLowerCase();
    if (key.startsWith("left") && /\bright\b|\br_|right/.test(lower)) {
      return [`${BODY_PART_LABELS[key]} points at a right-side bone`];
    }
    if (key.startsWith("right") && /\bleft\b|\bl_|left/.test(lower)) {
      return [`${BODY_PART_LABELS[key]} points at a left-side bone`];
    }
    return [];
  });

  const groups = Object.entries(BONE_GROUPS).map(([name, groupKeys]) => {
    const groupMissing = groupKeys.filter((key) => missing.includes(key));
    return {
      name,
      mapped: groupKeys.length - groupMissing.length,
      total: groupKeys.length,
      missing: groupMissing,
    };
  });

  const issues = [
    ...missing.slice(0, 4).map((key) => `${BODY_PART_LABELS[key]} is unmapped`),
    ...duplicates.map((boneName) => `${boneName} is mapped more than once`),
    ...suspicious,
  ];

  return {
    mapped,
    total: keys.length,
    score: clamp01(mapped / keys.length - duplicates.length * 0.04),
    missing,
    duplicates,
    suspicious,
    groups,
    issues,
  };
}

export function scorePoseLandmarks(
  input: PoseLandmarkInput | NormalizedLandmark[] | null | undefined,
): PoseQualityResult {
  const normalizedInput = Array.isArray(input)
    ? { worldLandmarks: input }
    : (input ?? {});
  const worldLandmarks = normalizedInput.worldLandmarks ?? null;
  const screenLandmarks =
    normalizedInput.screenLandmarks ?? normalizedInput.worldLandmarks ?? null;

  if (!worldLandmarks || worldLandmarks.length < 33) {
    return {
      score: 0,
      label: "Poor",
      warnings: ["No pose landmarks detected"],
      missingRequired: REQUIRED_LANDMARKS.map(([name]) => name),
      metrics: {
        visibility: 0,
        coverage: 0,
        inFrame: 0,
        limbConsistency: 0,
        depth: 0,
        plausibility: 0,
        mapping: normalizedInput.remap
          ? analyzeBoneMapping(
              normalizedInput.remap,
              normalizedInput.availableBones,
            ).score
          : 1,
      },
    };
  }

  const visibilityScores = REQUIRED_LANDMARKS.map(([, index]) =>
    visibilityOf(worldLandmarks, index),
  );
  const visibility =
    visibilityScores.reduce((sum, score) => sum + score, 0) /
    visibilityScores.length;
  const missingRequired = REQUIRED_LANDMARKS.filter(
    ([, index]) => visibilityOf(worldLandmarks, index) < 0.5,
  ).map(([name]) => name);
  const coverage = 1 - missingRequired.length / REQUIRED_LANDMARKS.length;
  const inFrame = scoreBodyInFrame(screenLandmarks);
  const limbConsistency = scoreLimbConsistency(worldLandmarks);
  const depth = scoreDepth(worldLandmarks);
  const plausibility = scorePlausibility(worldLandmarks);
  const mapping = normalizedInput.remap
    ? analyzeBoneMapping(
        normalizedInput.remap,
        normalizedInput.availableBones,
      ).score
    : 1;

  const score = clamp01(
    visibility * 0.25 +
      coverage * 0.2 +
      inFrame * 0.15 +
      limbConsistency * 0.15 +
      depth * 0.1 +
      plausibility * 0.1 +
      mapping * 0.05,
  );

  const warnings: string[] = [];
  if (missingRequired.length > 0) {
    warnings.push(`Low-confidence landmarks: ${missingRequired.join(", ")}`);
  }
  if (inFrame < 0.75) warnings.push("Body is partly outside the input frame");
  if (limbConsistency < 0.65) warnings.push("Left/right limb lengths disagree");
  if (depth < 0.6) warnings.push("Depth has large outliers");
  if (plausibility < 0.65) warnings.push("Pose geometry looks implausible");
  if (mapping < 0.85) warnings.push("Bone mapping is incomplete");

  return {
    score,
    label: score >= 0.78 ? "Good" : score >= 0.52 ? "Usable" : "Poor",
    warnings,
    missingRequired,
    metrics: {
      visibility,
      coverage,
      inFrame,
      limbConsistency,
      depth,
      plausibility,
      mapping,
    },
  };
}

export function selectBestPoseCandidate<T extends PoseLandmarkCandidate>(
  candidates: readonly T[],
  context: Omit<PoseLandmarkInput, "worldLandmarks" | "screenLandmarks"> = {},
): ScoredPoseCandidate<T> | null {
  let best: ScoredPoseCandidate<T> | null = null;

  for (const candidate of candidates) {
    const quality = scorePoseLandmarks({
      ...context,
      worldLandmarks: candidate.worldLandmarks,
      screenLandmarks: candidate.screenLandmarks,
    });
    if (!best || quality.score > best.quality.score) {
      best = { candidate, quality };
    }
  }

  return best;
}

function getObjectNameScore(object: THREE.Object3D) {
  let score = 0;
  if ((object as THREE.Bone).isBone) score += 100;
  if ((object as THREE.SkinnedMesh).isSkinnedMesh) score += 20;
  score += Math.min(object.children.length, 8) * 6;
  if (object.position.lengthSq() > 1e-8) score += 8;
  if (object.parent && object.parent.name !== object.name) score += 4;
  if (object.children.some((child) => child.name && child.name !== object.name)) {
    score += 8;
  }
  if (object.children.length === 0 && object.position.lengthSq() < 1e-8) {
    score -= 12;
  }
  return score;
}

export function buildPreferredNamedObjectMap(object: THREE.Object3D) {
  const map = new Map<string, THREE.Object3D>();
  object.traverse((child) => {
    if (!child.name) return;
    const current = map.get(child.name);
    if (!current || getObjectNameScore(child) > getObjectNameScore(current)) {
      map.set(child.name, child);
    }
  });
  return map;
}

function findMappedChild(
  key: keyof BoneRemap,
  bone: THREE.Object3D,
  remap: BoneRemap,
  namedObjects: Map<string, THREE.Object3D>,
) {
  const childKey = EXPECTED_CHILD_KEYS[key]?.find((candidate) =>
    namedObjects.has(remap[candidate]),
  );
  if (childKey) {
    const child = namedObjects.get(remap[childKey]);
    if (child) {
      return {
        childKey,
        childName: remap[childKey],
        child,
      };
    }
  }

  const fallback = bone.children.find((child) => child.name);
  return fallback
    ? {
        childName: fallback.name,
        child: fallback,
      }
    : {};
}

function computeRestDir(
  bone: THREE.Object3D,
  child: THREE.Object3D | undefined,
) {
  let restDir = new THREE.Vector3();

  if (child && bone.parent) {
    const boneWorldPosition = new THREE.Vector3();
    const childWorldPosition = new THREE.Vector3();
    bone.getWorldPosition(boneWorldPosition);
    child.getWorldPosition(childWorldPosition);
    restDir = childWorldPosition.sub(boneWorldPosition);

    if (restDir.lengthSq() > 1e-8) {
      const parentWorldQuat = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQuat);
      return restDir
        .normalize()
        .applyQuaternion(parentWorldQuat.invert())
        .normalize();
    }
  }

  restDir.copy(bone.position);
  if (restDir.lengthSq() < 1e-8) restDir.set(0, 1, 0);
  return restDir.normalize();
}

export function buildRigRetargetMap(
  object: THREE.Object3D,
  remap: BoneRemap,
): RigRetargetMap {
  object.updateMatrixWorld(true);
  const namedObjects = buildPreferredNamedObjectMap(object);
  const bones = new Map<keyof BoneRemap, RigRetargetBone>();
  const byName = new Map<string, RigRetargetBone>();

  for (const key of Object.keys(remap) as (keyof BoneRemap)[]) {
    const boneName = remap[key];
    const bone = namedObjects.get(boneName);
    if (!bone || byName.has(boneName)) continue;
    const childInfo = findMappedChild(key, bone, remap, namedObjects);
    const entry: RigRetargetBone = {
      key,
      boneName,
      bone,
      restQuat: bone.quaternion.clone(),
      restDir: computeRestDir(bone, childInfo.child),
      ...childInfo,
    };
    bones.set(key, entry);
    byName.set(boneName, entry);
  }

  return { bones, byName };
}

export function applyRetargetedPose(
  boneData: RigRetargetBone,
  fromWorld: THREE.Vector3,
  toWorld: THREE.Vector3,
) {
  const { bone, restDir, restQuat } = boneData;
  if (!bone.parent) return bone.quaternion;

  const dir = toWorld.clone().sub(fromWorld);
  if (dir.lengthSq() < 1e-8 || restDir.lengthSq() < 1e-8) {
    return bone.quaternion;
  }

  const parentWorldQuat = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorldQuat);
  const localDir = dir
    .normalize()
    .applyQuaternion(parentWorldQuat.invert())
    .normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);

  bone.quaternion.copy(restQuat).premultiply(delta);
  bone.updateMatrix();
  return bone.quaternion;
}

function clonePoseData(pose: PoseBoneData): PoseBoneData {
  return {
    hips: {
      boneName: pose.hips.boneName,
      position: pose.hips.position.clone(),
      quaternion: pose.hips.quaternion.clone(),
    },
    bones: pose.bones.map((bone) => ({
      boneKey: bone.boneKey,
      boneName: bone.boneName,
      quaternion: bone.quaternion.clone(),
    })),
  };
}

function calibrationOffset(
  current: THREE.Quaternion,
  rest: THREE.Quaternion,
) {
  return current.clone().invert().multiply(rest);
}

export function buildPoseCalibration(
  pose: PoseBoneData,
  rigMap: RigRetargetMap,
): PoseCalibration {
  const hipsRest = rigMap.bones.get("hips")?.restQuat ?? new THREE.Quaternion();
  const bones: Partial<Record<keyof BoneRemap, PoseBoneCalibration>> = {};

  for (const bone of pose.bones) {
    const restQuat =
      rigMap.bones.get(bone.boneKey)?.restQuat ?? new THREE.Quaternion();
    bones[bone.boneKey] = {
      boneKey: bone.boneKey,
      boneName: bone.boneName,
      offset: calibrationOffset(bone.quaternion, restQuat),
    };
  }

  return {
    createdAt: Date.now(),
    hips: {
      boneKey: "hips",
      boneName: pose.hips.boneName,
      offset: calibrationOffset(pose.hips.quaternion, hipsRest),
    },
    bones,
  };
}

export function applyPoseCalibration(
  pose: PoseBoneData,
  calibration: PoseCalibration | null | undefined,
) {
  const next = clonePoseData(pose);
  if (!calibration) return next;

  if (calibration.hips && calibration.hips.boneName === next.hips.boneName) {
    next.hips.quaternion.multiply(calibration.hips.offset);
  }

  next.bones = next.bones.map((bone) => {
    const offset = calibration.bones[bone.boneKey];
    if (!offset || offset.boneName !== bone.boneName) return bone;
    return {
      ...bone,
      quaternion: bone.quaternion.clone().multiply(offset.offset),
    };
  });

  return next;
}

function clampQuaternionTowardRest(
  quaternion: THREE.Quaternion,
  rest: THREE.Quaternion,
  maxAngleDeg: number,
) {
  const angle = rest.angleTo(quaternion);
  const maxAngle = THREE.MathUtils.degToRad(maxAngleDeg);
  if (angle <= maxAngle || angle < 1e-8) return quaternion.clone();
  return rest.clone().slerp(quaternion, maxAngle / angle);
}

export function clampAnatomicalPose(
  pose: PoseBoneData,
  rigMap: RigRetargetMap,
  limitsDeg: Partial<Record<keyof BoneRemap, number>> = ANATOMICAL_LIMITS_DEG,
) {
  const next = clonePoseData(pose);
  const hipsLimit = limitsDeg.hips;
  const hipsRest = rigMap.bones.get("hips")?.restQuat;
  if (hipsLimit && hipsRest) {
    next.hips.quaternion = clampQuaternionTowardRest(
      next.hips.quaternion,
      hipsRest,
      hipsLimit,
    );
  }

  next.bones = next.bones.map((bone) => {
    const limit = limitsDeg[bone.boneKey];
    const rest = rigMap.bones.get(bone.boneKey)?.restQuat;
    if (!limit || !rest) return bone;
    return {
      ...bone,
      quaternion: clampQuaternionTowardRest(bone.quaternion, rest, limit),
    };
  });

  return next;
}
