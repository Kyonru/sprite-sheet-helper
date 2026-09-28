import * as THREE from "three";

import type { BoneRemap } from "./bone-remap";
import type { RigRetargetMap } from "./pose-retargeting";
import { applyPoseDataToRig } from "./pose-solve";
import type { PoseFrame } from "./pose-to-animation";

/**
 * Objective quality metrics for a recorded pose sequence.
 *
 * These exist so that any claim about capture quality is backed by a number
 * from a repeatable command rather than by how a preview looked. Each one is
 * chosen to ATTRIBUTE a fault rather than just score it:
 *
 *   - bone-length variance   -> the skeleton is being stretched, not posed
 *   - angular jitter         -> per-frame solving with no temporal coherence
 *   - root jitter            -> unstable root/depth estimation
 *   - foot slide             -> root motion inconsistent with the legs
 *   - quaternion flips       -> tracks that will interpolate the long way
 *   - held-bone frames       -> the recovery is guessing behind occlusion
 *
 * Everything is computed by posing the real rig and reading world positions,
 * so the numbers describe what a viewer would actually see.
 */

export interface PoseMetrics {
  frames: number;
  fps: number;
  durationSec: number;
  /** Head-to-lowest-foot distance on the first frame, in rig units. */
  statureUnits: number;
  /** Worst relative variance of any bone's length across the clip. */
  boneLengthVariance: number;
  /** Mean |second difference| of joint rotation, deg/s^2. Jitter, not motion. */
  angularJitterDegPerSec2: number;
  /** Mean |second difference| of the hips' world position, rig units. */
  rootJitter: number;
  /** Sign flips found in the exported quaternion tracks. */
  quaternionDiscontinuities: number;
  footContacts: number;
  contactFrames: number;
  /**
   * Median world-space foot speed over the clip, rig units/sec.
   *
   * Reported because "zero contacts" is ambiguous on its own: it can mean the
   * feet genuinely never stop, or that the threshold is wrong for this rig's
   * scale. The median separates the two - a walking subject's feet are
   * stationary for roughly half of each stride, so a median far above the
   * contact threshold means the feet really are always moving.
   */
  footSpeedMedian: number;
  /** 10th percentile foot speed: how slow the feet get at their slowest. */
  footSpeedP10: number;
  /** Horizontal foot movement while a foot is planted, in rig units. */
  footSlideMean: number;
  footSlideMax: number;
}

/** A foot planted below this speed (rig units/sec) counts as in contact. */
const DEFAULT_CONTACT_SPEED = 0.15;
/** ...and within this height of the clip's lowest foot position. */
const DEFAULT_CONTACT_HEIGHT = 0.06;

export interface PoseMetricsOptions {
  fps: number;
  contactSpeed?: number;
  contactHeight?: number;
  /** Scales the contact thresholds, which are expressed for a ~1 unit character. */
  scale?: number;
  /**
   * Externally detected foot contacts, per frame.
   *
   * Strongly preferred over the built-in speed-and-height test. That test asks
   * "is the foot slow in WORLD space", which depends on the root - the very
   * thing foot slide is meant to judge - so it is circular, and it fails
   * outright when the reconstruction's feet never fully stop (measured: 10th
   * percentile foot speed 0.33-0.47 against a 0.156 threshold, giving zero
   * contacts and a foot-slide figure of 0.0 that looks perfect and means
   * nothing).
   *
   * `detectContacts` in pose-contacts.ts derives these from hip-relative
   * HEIGHT, which needs no root and is cleanly separable.
   */
  contacts?: { left: boolean[]; right: boolean[] };
  /**
   * Bone names to treat as the left/right contact points, overriding the
   * `leftFoot`/`rightFoot` ankle bones. Pass the toe bones when the rig has
   * them: the ankle keeps moving through the heel-to-toe roll even while the
   * foot is planted, which shows up as foot slide that is not really there.
   */
  contactBones?: { left?: string; right?: string };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * World positions of every mapped bone, for each frame.
 *
 * Poses the actual rig rather than doing an independent forward-kinematics
 * pass: a metric computed from a re-implementation of the hierarchy measures
 * the re-implementation.
 */
export function samplePoseWorldPositions(
  object: THREE.Object3D,
  rigMap: RigRetargetMap,
  frames: PoseFrame[],
  /**
   * Extra bones to sample by NAME, keyed into the same map.
   *
   * Needed because the canonical remap has no toe entry, and the toe is what
   * actually touches the floor: the `foot` bone is the ankle, which pivots
   * through heel strike and toe-off while the foot itself is planted.
   */
  extraBoneNames: string[] = [],
): Map<string, THREE.Vector3>[] {
  const out: Map<string, THREE.Vector3>[] = [];
  const scratch = new THREE.Vector3();
  const extras = new Map<string, THREE.Object3D>();
  for (const name of extraBoneNames) {
    const found = object.getObjectByName(name);
    if (found) extras.set(name, found);
  }
  for (const frame of frames) {
    applyPoseDataToRig(rigMap, frame.data);
    object.updateMatrixWorld(true);
    const positions = new Map<string, THREE.Vector3>();
    rigMap.bones.forEach((boneData, key) => {
      boneData.bone.getWorldPosition(scratch);
      positions.set(key, scratch.clone());
    });
    extras.forEach((bone, name) => {
      bone.getWorldPosition(scratch);
      positions.set(name, scratch.clone());
    });
    out.push(positions);
  }
  return out;
}

/** Parent/child bone pairs that form real limb segments in the canonical remap. */
const SEGMENTS: [keyof BoneRemap, keyof BoneRemap][] = [
  ["hips", "spine"],
  ["spine", "spine1"],
  ["spine1", "spine2"],
  ["spine2", "neck"],
  ["neck", "head"],
  ["leftShoulder", "leftArm"],
  ["leftArm", "leftForeArm"],
  ["rightShoulder", "rightArm"],
  ["rightArm", "rightForeArm"],
  ["leftUpLeg", "leftLeg"],
  ["leftLeg", "leftFoot"],
  ["rightUpLeg", "rightLeg"],
  ["rightLeg", "rightFoot"],
];

export function computePoseMetrics(
  object: THREE.Object3D,
  rigMap: RigRetargetMap,
  frames: PoseFrame[],
  options: PoseMetricsOptions,
): PoseMetrics {
  const fps = options.fps > 0 ? options.fps : 30;
  const dt = 1 / fps;
  const scale = options.scale ?? 1;
  const contactSpeed = (options.contactSpeed ?? DEFAULT_CONTACT_SPEED) * scale;
  const contactHeight = (options.contactHeight ?? DEFAULT_CONTACT_HEIGHT) * scale;

  const empty: PoseMetrics = {
    frames: frames.length,
    fps,
    durationSec: frames.length > 0 ? frames[frames.length - 1].time : 0,
    statureUnits: 0,
    boneLengthVariance: 0,
    angularJitterDegPerSec2: 0,
    rootJitter: 0,
    quaternionDiscontinuities: 0,
    footContacts: 0,
    contactFrames: 0,
    footSpeedMedian: 0,
    footSpeedP10: 0,
    footSlideMean: 0,
    footSlideMax: 0,
  };
  if (frames.length < 2) return empty;

  const contactBoneNames = [options.contactBones?.left, options.contactBones?.right]
    .filter((n): n is string => Boolean(n));
  const world = samplePoseWorldPositions(object, rigMap, frames, contactBoneNames);
  // Fall back to the ankle bones when no toe was supplied or found.
  const contactKeyFor = (side: "leftFoot" | "rightFoot"): string => {
    const name = side === "leftFoot" ? options.contactBones?.left : options.contactBones?.right;
    return name && world[0]?.has(name) ? name : side;
  };

  // ---- Bone-length variance ------------------------------------------------
  let boneLengthVariance = 0;
  for (const [parent, child] of SEGMENTS) {
    const lengths: number[] = [];
    for (const positions of world) {
      const a = positions.get(parent);
      const b = positions.get(child);
      if (!a || !b) continue;
      lengths.push(a.distanceTo(b));
    }
    if (lengths.length < 2) continue;
    const mean = lengths.reduce((s, v) => s + v, 0) / lengths.length;
    if (mean < 1e-9) continue;
    const variance =
      lengths.reduce((s, v) => s + (v - mean) ** 2, 0) / lengths.length;
    boneLengthVariance = Math.max(boneLengthVariance, variance / (mean * mean));
  }

  // ---- Angular jitter ------------------------------------------------------
  // How far each frame departs from constant angular velocity: extrapolate the
  // previous step forward and measure the error. Steady turning extrapolates
  // perfectly and scores zero; noise does not. A metric that merely measured
  // rotation SPEED would punish real motion instead.
  //
  // Note this deliberately compares the predicted and actual ROTATIONS, not
  // the size of the step. Comparing step sizes has a blind spot for the most
  // common jitter of all - a joint alternating between two poses has a
  // perfectly constant step size and would score zero.
  let jitterSum = 0;
  let jitterCount = 0;
  const keysOf = (frame: PoseFrame) => frame.data.bones.map((b) => b.boneKey);
  const quatOf = (frame: PoseFrame, key: keyof BoneRemap) =>
    frame.data.bones.find((b) => b.boneKey === key)?.quaternion;
  const step = new THREE.Quaternion();
  const predicted = new THREE.Quaternion();
  for (let i = 2; i < frames.length; i += 1) {
    for (const key of keysOf(frames[i])) {
      const a = quatOf(frames[i - 2], key);
      const b = quatOf(frames[i - 1], key);
      const c = quatOf(frames[i], key);
      if (!a || !b || !c) continue;
      // step = a^-1 * b, the rotation taking the previous frame to this one.
      step.copy(a).invert().multiply(b);
      // Extrapolate: applying the same step again predicts the next frame.
      predicted.copy(b).multiply(step);
      const error = 2 * Math.acos(Math.min(1, Math.abs(predicted.dot(c))));
      jitterSum += error / (dt * dt);
      jitterCount += 1;
    }
  }
  const angularJitter =
    jitterCount > 0 ? (jitterSum / jitterCount) * (180 / Math.PI) : 0;

  // ---- Root jitter ---------------------------------------------------------
  let rootJitterSum = 0;
  let rootJitterCount = 0;
  for (let i = 2; i < world.length; i += 1) {
    const a = world[i - 2].get("hips");
    const b = world[i - 1].get("hips");
    const c = world[i].get("hips");
    if (!a || !b || !c) continue;
    rootJitterSum += c.clone().sub(b.clone().multiplyScalar(2)).add(a).length();
    rootJitterCount += 1;
  }
  const rootJitter = rootJitterCount > 0 ? rootJitterSum / rootJitterCount : 0;

  // ---- Quaternion discontinuities -----------------------------------------
  let discontinuities = 0;
  const allKeys = new Set<keyof BoneRemap>();
  for (const frame of frames) for (const key of keysOf(frame)) allKeys.add(key);
  for (const key of allKeys) {
    for (let i = 1; i < frames.length; i += 1) {
      const a = quatOf(frames[i - 1], key);
      const b = quatOf(frames[i], key);
      if (a && b && a.dot(b) < 0) discontinuities += 1;
    }
  }
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i - 1].data.hips.quaternion.dot(frames[i].data.hips.quaternion) < 0) {
      discontinuities += 1;
    }
  }

  // ---- Contacts and foot slide --------------------------------------------
  const feet: string[] = [contactKeyFor("leftFoot"), contactKeyFor("rightFoot")];
  const leftContactKey = feet[0];
  let floor = Number.POSITIVE_INFINITY;
  for (const positions of world) {
    for (const foot of feet) {
      const p = positions.get(foot);
      if (p && p.y < floor) floor = p.y;
    }
  }

  let footContacts = 0;
  let contactFrames = 0;
  const slides: number[] = [];
  const footSpeeds: number[] = [];
  if (Number.isFinite(floor)) {
    for (const foot of feet) {
      const external = options.contacts
        ? foot === leftContactKey
          ? options.contacts.left
          : options.contacts.right
        : null;
      let inContact = false;
      for (let i = 1; i < world.length; i += 1) {
        const p = world[i].get(foot);
        const prev = world[i - 1].get(foot);
        if (!p || !prev) continue;
        const speed = p.distanceTo(prev) / dt;
        footSpeeds.push(speed);
        // Prefer externally detected contacts; both this frame and the last
        // must be down, since slide is measured between them.
        const planted = external
          ? Boolean(external[i] && external[i - 1])
          : p.y - floor <= contactHeight && speed <= contactSpeed;
        if (planted) {
          contactFrames += 1;
          if (!inContact) {
            footContacts += 1;
            inContact = true;
          }
          slides.push(Math.hypot(p.x - prev.x, p.z - prev.z));
        } else {
          inContact = false;
        }
      }
    }
  }

  // ---- Stature -------------------------------------------------------------
  const first = world[0];
  const head = first.get("head") ?? first.get("neck");
  let lowestFoot = Number.POSITIVE_INFINITY;
  for (const foot of feet) {
    const p = first.get(foot);
    if (p && p.y < lowestFoot) lowestFoot = p.y;
  }
  const stature =
    head && Number.isFinite(lowestFoot) ? head.y - lowestFoot : 0;

  return {
    frames: frames.length,
    fps,
    durationSec: frames[frames.length - 1].time,
    statureUnits: stature,
    boneLengthVariance,
    angularJitterDegPerSec2: angularJitter,
    rootJitter,
    quaternionDiscontinuities: discontinuities,
    footContacts,
    contactFrames,
    footSpeedMedian: median(footSpeeds),
    footSpeedP10:
      footSpeeds.length > 0
        ? [...footSpeeds].sort((a, b) => a - b)[Math.floor(footSpeeds.length * 0.1)]
        : 0,
    footSlideMean: slides.length > 0 ? slides.reduce((s, v) => s + v, 0) / slides.length : 0,
    footSlideMax: slides.length > 0 ? Math.max(...slides) : 0,
  };
}

/**
 * Mean angle between two clips' bone directions, expressed in each clip's own
 * ROOT-LOCAL frame, in degrees.
 *
 * Two corrections learned the hard way in the EasyMocap experiment, both worth
 * stating because each produced confidently wrong numbers:
 *
 *   1. Never compare local joint quaternions across providers. Different rest
 *      poses parameterise the same world pose differently, so identical motion
 *      reads as a 100 degree disagreement.
 *   2. Never compare WORLD directions across clips either. Recovery happens in
 *      camera space, so two clips of the same performance can face 191 degrees
 *      apart and every direction is compared across that offset.
 *
 * Root-local bone directions are free of both problems.
 */
export function compareBoneDirections(
  a: { world: Map<string, THREE.Vector3>[]; rootQuats: THREE.Quaternion[] },
  b: { world: Map<string, THREE.Vector3>[]; rootQuats: THREE.Quaternion[] },
): { perSegment: { segment: string; meanDeg: number; maxDeg: number }[]; overallMeanDeg: number } {
  const n = Math.min(a.world.length, b.world.length);
  const perSegment: { segment: string; meanDeg: number; maxDeg: number }[] = [];

  const dirIn = (
    positions: Map<string, THREE.Vector3>,
    root: THREE.Quaternion,
    parent: keyof BoneRemap,
    child: keyof BoneRemap,
  ) => {
    const p = positions.get(parent);
    const c = positions.get(child);
    if (!p || !c) return null;
    const d = c.clone().sub(p);
    if (d.lengthSq() < 1e-12) return null;
    return d.normalize().applyQuaternion(root.clone().invert());
  };

  for (const [parent, child] of SEGMENTS) {
    let sum = 0;
    let max = 0;
    let count = 0;
    for (let i = 0; i < n; i += 1) {
      const da = dirIn(a.world[i], a.rootQuats[i], parent, child);
      const db = dirIn(b.world[i], b.rootQuats[i], parent, child);
      if (!da || !db) continue;
      const deg = (Math.acos(Math.min(1, Math.max(-1, da.dot(db)))) * 180) / Math.PI;
      sum += deg;
      max = Math.max(max, deg);
      count += 1;
    }
    if (count > 0) {
      perSegment.push({ segment: `${parent}->${child}`, meanDeg: sum / count, maxDeg: max });
    }
  }

  perSegment.sort((x, y) => y.meanDeg - x.meanDeg);
  const overall =
    perSegment.length > 0
      ? perSegment.reduce((s, r) => s + r.meanDeg, 0) / perSegment.length
      : 0;
  return { perSegment, overallMeanDeg: overall };
}

/**
 * Zero-phase smoothing of a sampled signal: filter forwards, then backwards.
 *
 * Why this exists: comparing a causal filter's output against the RAW signal
 * cannot tell "removed noise" from "removed motion" - both look like movement
 * away from raw. A non-causal filter introduces no lag by construction (the
 * backward pass cancels the forward pass's phase shift), so it is a usable
 * stand-in for the underlying signal, and a causal filter's error against it
 * measures real lag rather than mere difference.
 *
 * Deliberately a plain symmetric moving average rather than anything cleverer:
 * it is only a reference, and a reference nobody can reason about is worse
 * than a slightly blunt one. It sees the whole clip at once and so can never
 * be used at capture time - only for offline evaluation.
 */
export function zeroPhaseSmooth(
  values: THREE.Vector3[],
  window: number,
): THREE.Vector3[] {
  if (values.length === 0 || window < 2) return values.map((v) => v.clone());
  const half = Math.floor(window / 2);
  const pass = (input: THREE.Vector3[]): THREE.Vector3[] =>
    input.map((_, i) => {
      const acc = new THREE.Vector3();
      let n = 0;
      for (let k = i - half; k <= i + half; k += 1) {
        if (k < 0 || k >= input.length) continue;
        acc.add(input[k]);
        n += 1;
      }
      return acc.divideScalar(Math.max(1, n));
    });
  // Forward, then backward over the reversed series: the two phase shifts cancel.
  const forward = pass(values);
  const backward = pass([...forward].reverse()).reverse();
  return backward;
}

export { median };

/**
 * Detect LANDMARK DISCONTINUITIES - frames where every landmark jumps at once.
 *
 * Two different things cause this and the detector CANNOT TELL THEM APART:
 *
 *   - a shot cut, where the footage jumps to another angle, subject or scene;
 *   - the detector losing and re-acquiring the pose, which happens on
 *     ambiguous input such as a silhouette.
 *
 * Both make pose solving follow a discontinuity, and both show up as a burst
 * of apparent limb acceleration. Found while stress-testing a corpus: the two
 * worst clips by angular jitter (2282 and 863 deg/s^2 against a well-behaved
 * 244) were montages with real cuts - but a smooth silhouette animation with
 * no cuts at all also reported 15 events, which were the detector flickering.
 *
 * So this is an ATTRIBUTION HINT, not an excuse. High jitter remains a quality
 * problem whichever cause it has; this only says where to look.
 *
 * Cuts are detected against the clip's OWN motion statistics rather than a
 * fixed threshold, so fast legitimate movement is not mistaken for a cut: a
 * cut is a jump far outside the distribution of ordinary frame-to-frame
 * motion, not merely a large one.
 *
 * @param frames Per-frame landmark arrays, in any consistent coordinate space.
 * @returns Frame indices where a discontinuity begins.
 */
export function detectLandmarkDiscontinuities(
  frames: ({ x: number; y: number; z: number }[] | null | undefined)[],
  options: { sigma?: number; minJump?: number } = {},
): { events: number[]; medianMotion: number } {
  const sigma = options.sigma ?? 6;
  const minJump = options.minJump ?? 0.08;

  const motion: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const now = frames[i];
    const prev = frames[i - 1];
    if (!now || !prev || now.length !== prev.length) {
      motion.push(Number.NaN);
      continue;
    }
    let sum = 0;
    for (let k = 0; k < now.length; k += 1) {
      sum += Math.hypot(now[k].x - prev[k].x, now[k].y - prev[k].y, now[k].z - prev[k].z);
    }
    motion.push(sum / Math.max(1, now.length));
  }

  const valid = motion.filter((v) => Number.isFinite(v));
  if (valid.length < 4) return { events: [], medianMotion: 0 };
  const med = median(valid);
  // Median absolute deviation: robust to the very outliers being looked for,
  // unlike a standard deviation which the cuts themselves would inflate.
  const mad = median(valid.map((v) => Math.abs(v - med)));
  const scale = Math.max(mad * 1.4826, 1e-6);

  const events: number[] = [];
  motion.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    if (v > med + sigma * scale && v > minJump) events.push(i + 1);
  });
  return { events, medianMotion: med };
}

/**
 * Peak-to-peak amplitude of the root's yaw, in degrees.
 *
 * A physical cross-check, not a quality score. Any step that AVERAGES two
 * estimates of the body's across-axis will reduce jitter and reduce error
 * against a smoothed reference, because averaging reduces variance - both of
 * those metrics improve whether or not the result is more correct. Pelvic
 * rotation in the transverse plane has a known range during level walking
 * (roughly +-4 to +-8 degrees, so 8-16 peak to peak), so the amplitude says
 * whether real motion is being damped out along with the noise.
 *
 * The mean facing is removed by measuring against the clip's own median yaw,
 * so this is independent of which way the performer happens to walk.
 *
 * @param quats Per-frame root rotations, in a consistent frame.
 * @param forward The rig's rest forward direction.
 */
export function yawAmplitudeDeg(
  quats: THREE.Quaternion[],
  forward: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
): { peakToPeakDeg: number; stdDeg: number } {
  const angles: number[] = [];
  const dir = new THREE.Vector3();
  for (const q of quats) {
    dir.copy(forward).applyQuaternion(q);
    dir.y = 0;
    if (dir.lengthSq() < 1e-12) continue;
    angles.push(Math.atan2(dir.x, dir.z));
  }
  if (angles.length < 2) return { peakToPeakDeg: 0, stdDeg: 0 };

  // Unwrap against the CIRCULAR mean - the direction of the summed unit
  // vectors - not a plain median of the angles. A plain median is not a
  // circular statistic: for a clip facing near +-180 degrees, angles of
  // [176, 179, -179, -176] have a median of 0, which puts every frame ~178
  // degrees from centre and reports a 358 degree swing where the real one is 8.
  const centre = Math.atan2(
    angles.reduce((a, t) => a + Math.sin(t), 0),
    angles.reduce((a, t) => a + Math.cos(t), 0),
  );
  const rel = angles.map((a) => {
    let d = a - centre;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return (d * 180) / Math.PI;
  });

  const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
  const variance = rel.reduce((a, b) => a + (b - mean) ** 2, 0) / rel.length;
  return {
    peakToPeakDeg: Math.max(...rel) - Math.min(...rel),
    stdDeg: Math.sqrt(variance),
  };
}
