import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Root translation recovery, and what to do with it.
 *
 * ## Why this is needed at all
 *
 * MediaPipe's world landmarks are HIP-CENTRED: the hip midpoint is the origin
 * in every frame. Measured on a walking clip, the world hip centre stayed
 * within 1 mm of the origin for the whole take while the screen hip centre
 * crossed most of the frame. They contain the pose and no global motion
 * whatsoever.
 *
 * Without root motion every world-space quantity downstream is wrong the same
 * way: a planted foot appears to slide backwards under a stationary body. On
 * the reference clip only 2 frames out of 71 registered a foot contact, which
 * made the foot-slide metric rest on almost no data. So recovering translation
 * is not a nice-to-have; it is what makes ground contact measurable.
 *
 * ## The model
 *
 * Weak perspective, deliberately the simplest thing that is honest:
 *
 *     Z = f * L_metric / L_pixels     (apparent size gives depth)
 *     X = -(u - cx) * Z / f           (negated to match the world-landmark
 *     Y = -(v - cy) * Z / f            mirroring in `landmarksToJointPositions`)
 *
 * Depth comes from comparing several rigid segments' known metric lengths
 * against their observed pixel lengths, taking the median so one badly placed
 * landmark cannot dominate. Segments pointing near the view axis foreshorten
 * to nothing and are skipped rather than allowed to explode.
 *
 * ## Limits, stated because this is an estimate
 *
 * The focal length is assumed, not calibrated. Absolute depth is only as good
 * as the assumed body proportions, and depth error grows with distance. Only
 * RELATIVE motion is returned - the clip is anchored at its first frame -
 * because that is the part which is trustworthy and the part everything
 * downstream actually uses.
 */

/** MediaPipe landmark indices used here. */
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/** Rigid segments used to estimate depth, as landmark index pairs. */
const DEPTH_SEGMENTS: readonly (readonly [number, number])[] = [
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
];

/** A segment shorter than this in pixels is too foreshortened to trust. */
const MIN_PIXEL_LENGTH = 12;
/** Below this visibility a segment is excluded from the depth estimate. */
const MIN_SEGMENT_VISIBILITY = 0.5;

export type RootMotionMode = "preserve" | "in-place" | "scaled";

export interface CameraModel {
  imageWidth: number;
  imageHeight: number;
  /**
   * Focal length in pixels. Uncalibrated video has no true value; the default
   * is 0.75 * the longest image side, which is what EasyMocap assumes for an
   * unknown camera and what it independently chose for the reference clip.
   */
  focalPx?: number;
}

export function defaultFocalPx(imageWidth: number, imageHeight: number): number {
  return Math.max(imageWidth, imageHeight) * 0.75;
}

/**
 * Median metric length of each depth segment, from the world landmarks.
 *
 * Solved once for a whole clip. Landmark-derived bone lengths wobble by a few
 * percent every frame; a median over the take is stable, and using a per-frame
 * length would feed that wobble straight into the depth estimate.
 */
export function solveSegmentLengths(
  worldFrames: (NormalizedLandmark[] | null | undefined)[],
): Map<string, number> {
  const samples = new Map<string, number[]>();
  for (const frame of worldFrames) {
    if (!frame || frame.length < 33) continue;
    for (const [a, b] of DEPTH_SEGMENTS) {
      const pa = frame[a];
      const pb = frame[b];
      if (!pa || !pb) continue;
      const length = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
      if (!Number.isFinite(length) || length <= 0) continue;
      const key = `${a}-${b}`;
      const list = samples.get(key) ?? [];
      list.push(length);
      samples.set(key, list);
    }
  }

  const out = new Map<string, number>();
  for (const [key, list] of samples) {
    const sorted = [...list].sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    out.set(key, sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
  }
  return out;
}

export interface RootRecoveryResult {
  /** Hip-centre position per frame, in metres, anchored at the first frame. */
  translations: THREE.Vector3[];
  /** Median subject depth, metres. Diagnostic only - it rests on an assumed focal. */
  medianDepth: number;
  focalPx: number;
  /** Frames with no usable depth estimate, whose position was held. */
  gapFrames: number;
}

/**
 * Per-frame hip-centre position from the SCREEN landmarks.
 *
 * `segmentLengths` should come from `solveSegmentLengths` over the same clip.
 */
export function recoverRootTranslations(
  screenFrames: (NormalizedLandmark[] | null | undefined)[],
  segmentLengths: Map<string, number>,
  camera: CameraModel,
): RootRecoveryResult {
  const width = camera.imageWidth;
  const height = camera.imageHeight;
  const focalPx = camera.focalPx ?? defaultFocalPx(width, height);
  const cx = width / 2;
  const cy = height / 2;

  const depths: number[] = [];
  const raw: (THREE.Vector3 | null)[] = screenFrames.map((frame) => {
    if (!frame || frame.length < 33) return null;

    const estimates: number[] = [];
    for (const [a, b] of DEPTH_SEGMENTS) {
      const metric = segmentLengths.get(`${a}-${b}`);
      if (!metric || metric <= 1e-4) continue;
      const pa = frame[a];
      const pb = frame[b];
      if (!pa || !pb) continue;
      if (
        (pa.visibility ?? 1) < MIN_SEGMENT_VISIBILITY ||
        (pb.visibility ?? 1) < MIN_SEGMENT_VISIBILITY
      ) {
        continue;
      }
      const pixels = Math.hypot((pa.x - pb.x) * width, (pa.y - pb.y) * height);
      if (pixels < MIN_PIXEL_LENGTH) continue;
      estimates.push((focalPx * metric) / pixels);
    }
    if (estimates.length === 0) return null;

    estimates.sort((x, y) => x - y);
    const mid = Math.floor(estimates.length / 2);
    const depth =
      estimates.length % 2 ? estimates[mid] : (estimates[mid - 1] + estimates[mid]) / 2;
    depths.push(depth);

    const hipL = frame[LM.LEFT_HIP];
    const hipR = frame[LM.RIGHT_HIP];
    if (!hipL || !hipR) return null;
    const u = ((hipL.x + hipR.x) / 2) * width;
    const v = ((hipL.y + hipR.y) / 2) * height;

    // Mirrored on X and Y to match `landmarksToJointPositions`, which maps a
    // MediaPipe landmark to (-x, -y, z).
    return new THREE.Vector3(
      (-(u - cx) * depth) / focalPx,
      (-(v - cy) * depth) / focalPx,
      depth,
    );
  });

  // Hold through gaps rather than dropping frames, so the track stays aligned
  // with the pose frames it belongs to.
  let gapFrames = 0;
  let last = new THREE.Vector3();
  const held: THREE.Vector3[] = raw.map((value) => {
    if (value) {
      last = value;
      return value.clone();
    }
    gapFrames += 1;
    return last.clone();
  });

  // Absolute depth rests on an assumed focal length, so only the relative
  // motion is returned. Anchoring at frame 0 makes that explicit.
  const anchor = held.length > 0 ? held[0].clone() : new THREE.Vector3();
  const translations = held.map((value) => value.sub(anchor));

  depths.sort((x, y) => x - y);
  return {
    translations,
    medianDepth: depths.length > 0 ? depths[Math.floor(depths.length / 2)] : 0,
    focalPx,
    gapFrames,
  };
}

/**
 * The performer's hip height in metres, from the world landmarks.
 *
 * Needed by `scaled` root motion. A rig whose legs are longer than the
 * performer's sweeps further per stride for the same joint angles, so it must
 * cover proportionally more ground or its feet will skate. Measured as the
 * median hip-to-ankle distance plus a small ankle-to-floor allowance.
 */
export function solveSourceHipHeight(
  worldFrames: (NormalizedLandmark[] | null | undefined)[],
): number {
  const samples: number[] = [];
  for (const frame of worldFrames) {
    if (!frame || frame.length < 33) continue;
    for (const [hip, ankle] of [
      [LM.LEFT_HIP, LM.LEFT_ANKLE],
      [LM.RIGHT_HIP, LM.RIGHT_ANKLE],
    ] as const) {
      const a = frame[hip];
      const b = frame[ankle];
      if (!a || !b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (Number.isFinite(d) && d > 0) samples.push(d);
    }
  }
  if (samples.length === 0) return 0;
  samples.sort((x, y) => x - y);
  const mid = Math.floor(samples.length / 2);
  const hipToAnkle = samples.length % 2 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
  // The ankle sits a little above the floor; ~7% of leg length is the usual
  // anthropometric figure and the estimate is not sensitive to it.
  return hipToAnkle * 1.07;
}

/**
 * Root translation solved from the FEET rather than from a camera model.
 *
 * A planted foot is stationary in the world by definition, so while it is
 * planted the body's velocity is exactly the negative of that foot's
 * hip-relative velocity. Integrating that gives a root trajectory which is
 * consistent with the legs BY CONSTRUCTION - feet plant, and foot slide goes
 * to near zero without any calibration.
 *
 * This is preferred over the weak-perspective estimate because it has no
 * dependence on focal length, subject depth or assumed body proportions, all
 * of which the screen-space method must guess. Measured on the reference clip,
 * weak perspective over-estimated travel by roughly 18%, which was enough that
 * no foot ever came to rest and NOT ONE contact was detected.
 *
 * What it cannot do: recover motion toward or away from the camera when both
 * feet leave the ground (a jump), and it accumulates drift over a long take,
 * since it is an integration. For sprite work, where clips are short and the
 * usual mode is in-place anyway, neither matters much.
 */
export function solveRootFromFeet(
  worldFrames: (NormalizedLandmark[] | null | undefined)[],
  fps: number,
): { translations: THREE.Vector3[]; plantedFrames: number } {
  const dt = fps > 0 ? 1 / fps : 1 / 30;

  // Hip-relative contact points in the app's world frame, which mirrors X and
  // Y relative to MediaPipe's (see landmarksToJointPositions).
  //
  // HEEL and TOE, not the ankle. The foot pivots about the ankle through heel
  // strike and toe-off, so the ankle keeps moving while the foot is planted -
  // using it under-estimates how far the body travelled. The heel and toe are
  // the parts that are actually still.
  const CONTACTS = [
    LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX,
    LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX,
  ] as const;
  const relative = worldFrames.map((frame) => {
    if (!frame || frame.length < 33) return null;
    const hipY = (frame[LM.LEFT_HIP].y + frame[LM.RIGHT_HIP].y) / 2;
    const hipX = (frame[LM.LEFT_HIP].x + frame[LM.RIGHT_HIP].x) / 2;
    const hipZ = (frame[LM.LEFT_HIP].z + frame[LM.RIGHT_HIP].z) / 2;
    const at = (i: number) =>
      new THREE.Vector3(
        -(frame[i].x - hipX),
        -(frame[i].y - hipY),
        frame[i].z - hipZ,
      );
    return CONTACTS.map(at);
  });

  const translations: THREE.Vector3[] = [new THREE.Vector3()];
  let plantedFrames = 0;

  for (let i = 1; i < relative.length; i += 1) {
    const now = relative[i];
    const prev = relative[i - 1];
    if (!now || !prev) {
      translations.push(translations[i - 1].clone());
      continue;
    }

    // Weight each contact point by how low it is: the lowest is the one
    // bearing weight. A soft weighting rather than a hard pick keeps the root
    // smooth through double support and through the heel-to-toe roll, where
    // the contact point migrates along one foot.
    const lowest = Math.min(...now.map((p) => p.y));
    // Falls off over ~3 cm, the scale of a real weight transfer.
    const weights = now.map((p) => Math.exp(-(p.y - lowest) / 0.03));
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total < 1e-9) {
      translations.push(translations[i - 1].clone());
      continue;
    }
    plantedFrames += 1;

    // Body velocity = -(weighted mean contact-point velocity).
    const bodyVelocity = new THREE.Vector3();
    now.forEach((p, k) => {
      bodyVelocity.addScaledVector(
        p.clone().sub(prev[k]).divideScalar(dt),
        weights[k] / total,
      );
    });
    bodyVelocity.negate();

    translations.push(
      translations[i - 1].clone().add(bodyVelocity.multiplyScalar(dt)),
    );
  }

  return { translations, plantedFrames };
}

export interface RootMotionOptions {
  mode: RootMotionMode;
  /**
   * Metres per rig unit. Recovered translation is metric; the rig may not be.
   */
  metresPerUnit?: number;
  /** For `scaled`: the target rig's hip height, in metres. */
  targetHipHeight?: number;
  /** For `scaled`: the performer's hip height, in metres. */
  sourceHipHeight?: number;
}

/**
 * Apply a root-motion mode to recovered translations, returning rig units.
 *
 * `in-place` is the default for sprite work and the reason is measured, not
 * stylistic: under a perspective workflow camera, preserved translation makes
 * the character's apparent size swing wildly between direction rows, which
 * `--fit auto` cannot compensate for. In-place keeps the vertical bob, which
 * is what carries the weight of a step.
 */
export function applyRootMotionMode(
  translations: THREE.Vector3[],
  options: RootMotionOptions,
): THREE.Vector3[] {
  const metresPerUnit = options.metresPerUnit && options.metresPerUnit > 0
    ? options.metresPerUnit
    : 1;
  let gain = 1 / metresPerUnit;

  if (options.mode === "scaled") {
    const source = options.sourceHipHeight ?? 0;
    const target = options.targetHipHeight ?? 0;
    if (source > 1e-6 && target > 1e-6) gain *= target / source;
  }

  return translations.map((t) =>
    options.mode === "in-place"
      ? new THREE.Vector3(0, t.y * gain, 0)
      : new THREE.Vector3(t.x * gain, t.y * gain, t.z * gain),
  );
}
