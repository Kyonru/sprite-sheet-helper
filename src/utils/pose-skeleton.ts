import * as THREE from "three";

import type { JointPositions } from "./mediapipe-to-bones";

/**
 * A fixed skeleton, solved once per clip (PLAN-mediapipe-mocap.md, finding 6).
 *
 * MediaPipe estimates every landmark independently per frame, so the distance
 * between two of them wobbles even when the underlying bone cannot change
 * length - measured at 5.6% median absolute deviation on the reference clip.
 * That wobble is pure noise, and it leaks into everything downstream: a knee
 * that drifts 5% closer to the hip moves the ankle, which moves the foot's
 * height above the hips, which is exactly what contact detection keys on.
 *
 * Solving one set of lengths for the whole clip and re-projecting each frame
 * onto them removes that degree of freedom. It cannot remove ANGULAR error -
 * the observed directions are kept exactly - so this is a strict narrowing of
 * what the reconstruction is allowed to get wrong, not a smoothing pass.
 */

/** Segment lengths in landmark metres, keyed by chain segment. */
export interface SkeletonLengths {
  spine: number;
  neck: number;
  nose: number;
  leftHipHalf: number;
  rightHipHalf: number;
  leftShoulderHalf: number;
  rightShoulderHalf: number;
  leftUpperArm: number;
  rightUpperArm: number;
  leftForeArm: number;
  rightForeArm: number;
  leftUpLeg: number;
  rightUpLeg: number;
  leftLowerLeg: number;
  rightLowerLeg: number;
  leftAnkleHeel: number;
  rightAnkleHeel: number;
  leftAnkleToe: number;
  rightAnkleToe: number;
}

/** The pairs whose lengths are averaged when symmetry is enforced. */
const MIRROR_PAIRS: [keyof SkeletonLengths, keyof SkeletonLengths][] = [
  ["leftHipHalf", "rightHipHalf"],
  ["leftShoulderHalf", "rightShoulderHalf"],
  ["leftUpperArm", "rightUpperArm"],
  ["leftForeArm", "rightForeArm"],
  ["leftUpLeg", "rightUpLeg"],
  ["leftLowerLeg", "rightLowerLeg"],
  ["leftAnkleHeel", "rightAnkleHeel"],
  ["leftAnkleToe", "rightAnkleToe"],
];

/** Every segment, as (name, from, to) over `JointPositions`. */
const SEGMENTS: [keyof SkeletonLengths, keyof JointPositions, keyof JointPositions][] = [
  ["spine", "hipCenter", "shoulderCenter"],
  ["neck", "shoulderCenter", "earCenter"],
  ["nose", "shoulderCenter", "nose"],
  ["leftHipHalf", "hipCenter", "leftHip"],
  ["rightHipHalf", "hipCenter", "rightHip"],
  ["leftShoulderHalf", "shoulderCenter", "leftShoulder"],
  ["rightShoulderHalf", "shoulderCenter", "rightShoulder"],
  ["leftUpperArm", "leftShoulder", "leftElbow"],
  ["rightUpperArm", "rightShoulder", "rightElbow"],
  ["leftForeArm", "leftElbow", "leftWrist"],
  ["rightForeArm", "rightElbow", "rightWrist"],
  ["leftUpLeg", "leftHip", "leftKnee"],
  ["rightUpLeg", "rightHip", "rightKnee"],
  ["leftLowerLeg", "leftKnee", "leftAnkle"],
  ["rightLowerLeg", "rightKnee", "rightAnkle"],
  ["leftAnkleHeel", "leftAnkle", "leftHeel"],
  ["rightAnkleHeel", "rightAnkle", "rightHeel"],
  ["leftAnkleToe", "leftAnkle", "leftFootIndex"],
  ["rightAnkleToe", "rightAnkle", "rightFootIndex"],
];

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
}

export interface SolveSkeletonOptions {
  /**
   * Force left/right lengths equal.
   *
   * On by default, and it is doing more than tidying. In a profile shot the far
   * limb is occluded and MediaPipe systematically foreshortens it, so the two
   * sides disagree by a bias rather than by noise. Averaging them lengthens the
   * far limb back toward the near one, which is the same near/far asymmetry the
   * per-foot contact thresholds had to work around.
   */
  symmetric?: boolean;
}

/**
 * Median segment lengths across a clip.
 *
 * Median, not mean: a handful of frames where a limb is badly mis-detected
 * would drag a mean, and those frames are exactly the ones a fixed skeleton is
 * meant to repair.
 */
export function solveFixedSkeleton(
  frames: JointPositions[],
  options: SolveSkeletonOptions = {},
): SkeletonLengths {
  const symmetric = options.symmetric ?? true;
  const lengths = {} as SkeletonLengths;

  for (const [name, from, to] of SEGMENTS) {
    const samples: number[] = [];
    for (const frame of frames) {
      const d = frame[to].distanceTo(frame[from]);
      if (Number.isFinite(d) && d > 1e-9) samples.push(d);
    }
    lengths[name] = medianOf(samples);
  }

  if (symmetric) {
    for (const [left, right] of MIRROR_PAIRS) {
      const mean = (lengths[left] + lengths[right]) * 0.5;
      lengths[left] = mean;
      lengths[right] = mean;
    }
  }

  return lengths;
}

/** Median absolute deviation of each segment's length, as a fraction of its median. */
export function segmentLengthVariation(frames: JointPositions[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, from, to] of SEGMENTS) {
    const samples = frames
      .map((f) => f[to].distanceTo(f[from]))
      .filter((d) => Number.isFinite(d) && d > 1e-9);
    const med = medianOf(samples);
    if (med <= 1e-9) {
      out[name] = 0;
      continue;
    }
    out[name] = medianOf(samples.map((d) => Math.abs(d - med))) / med;
  }
  return out;
}

/** Place `to` at a fixed distance from `from`, keeping the observed direction. */
function project(from: THREE.Vector3, to: THREE.Vector3, length: number): THREE.Vector3 {
  const dir = to.clone().sub(from);
  const observed = dir.length();
  // A degenerate direction carries no information to re-project along, so the
  // observed point is kept rather than inventing an axis for it.
  if (observed < 1e-9 || length <= 0) return to.clone();
  return from.clone().addScaledVector(dir.divideScalar(observed), length);
}

/**
 * Re-project one frame's joints onto the fixed skeleton.
 *
 * Walks outward from the hip centre so each segment is placed relative to an
 * already-corrected parent, the same order the rig itself is solved in. Every
 * segment's DIRECTION is preserved exactly; only its length changes.
 */
export function applyFixedSkeleton(
  j: JointPositions,
  lengths: SkeletonLengths,
  options: { feet?: boolean } = {},
): JointPositions {
  // The heel and toe hang off the ankle, which is itself re-projected, so they
  // inherit its angular error on top of their own. Separable so the cost can be
  // attributed rather than assumed.
  const fixFeet = options.feet ?? true;
  const hipCenter = j.hipCenter.clone();
  const shoulderCenter = project(hipCenter, j.shoulderCenter, lengths.spine);

  const leftHip = project(hipCenter, j.leftHip, lengths.leftHipHalf);
  const rightHip = project(hipCenter, j.rightHip, lengths.rightHipHalf);
  const leftShoulder = project(shoulderCenter, j.leftShoulder, lengths.leftShoulderHalf);
  const rightShoulder = project(shoulderCenter, j.rightShoulder, lengths.rightShoulderHalf);

  const leftElbow = project(leftShoulder, j.leftElbow, lengths.leftUpperArm);
  const rightElbow = project(rightShoulder, j.rightElbow, lengths.rightUpperArm);
  const leftWrist = project(leftElbow, j.leftWrist, lengths.leftForeArm);
  const rightWrist = project(rightElbow, j.rightWrist, lengths.rightForeArm);

  const leftKnee = project(leftHip, j.leftKnee, lengths.leftUpLeg);
  const rightKnee = project(rightHip, j.rightKnee, lengths.rightUpLeg);
  const leftAnkle = project(leftKnee, j.leftAnkle, lengths.leftLowerLeg);
  const rightAnkle = project(rightKnee, j.rightAnkle, lengths.rightLowerLeg);

  return {
    hipCenter,
    shoulderCenter,
    leftHip,
    rightHip,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    leftHeel: fixFeet ? project(leftAnkle, j.leftHeel, lengths.leftAnkleHeel) : j.leftHeel.clone(),
    rightHeel: fixFeet ? project(rightAnkle, j.rightHeel, lengths.rightAnkleHeel) : j.rightHeel.clone(),
    leftFootIndex: fixFeet
      ? project(leftAnkle, j.leftFootIndex, lengths.leftAnkleToe)
      : j.leftFootIndex.clone(),
    rightFootIndex: fixFeet
      ? project(rightAnkle, j.rightFootIndex, lengths.rightAnkleToe)
      : j.rightFootIndex.clone(),
    earCenter: project(shoulderCenter, j.earCenter, lengths.neck),
    nose: project(shoulderCenter, j.nose, lengths.nose),
  };
}
