import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Foot-contact detection from pose landmarks.
 *
 * ## Why height, and not speed
 *
 * The obvious detector - "a foot is planted when it stops moving" - does not
 * work on this data. Measured on a walking clip, the 10th-percentile foot
 * speed was 0.37-0.47 rig units/s against a sensible contact threshold of
 * 0.156: the reconstruction's feet never come to rest, so a speed test finds
 * almost nothing. Worse, world-space speed depends on the root, and the root
 * is what we are trying to solve, so keying on it is circular.
 *
 * Hip-relative HEIGHT is clean. On the same clip a planted foot sat at about
 * -0.83 and a lifted one at about -0.60 - a 0.23 m separation, far larger than
 * the noise. It needs no root, so contacts can be found first and the root
 * solved from them afterwards, which is the right direction of causality.
 *
 * A hip-relative signal also survives the camera moving or the subject
 * changing depth, neither of which a world-space test tolerates.
 */

const LM = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type FootSide = "left" | "right";

export interface ContactOptions {
  /**
   * A foot counts as down when it is within this fraction of the clip's
   * observed foot-height range, measured up from the lowest point.
   * Fractional rather than absolute so it transfers between subjects and
   * camera distances without retuning.
   */
  downFraction?: number;
  /** Hysteresis: a foot already down stays down until this higher fraction. */
  upFraction?: number;
  /** Contacts shorter than this many frames are treated as detector chatter. */
  minFrames?: number;
  /**
   * Derive thresholds separately for each foot.
   *
   * On by default, and the reason is measured. With one shared threshold the
   * near foot in a profile shot is detected as down 87% of the time and the
   * occluded far foot only 49% - real walking is about 62% each, and double
   * support came out at 37% against a real 20-25%. MediaPipe places the
   * occluded foot systematically higher, and a shared threshold turns that
   * depth bias directly into a contact bias. Normalising each foot against its
   * own range cancels it.
   *
   * Turn off only when the feet genuinely share a range and one of them barely
   * moves, where per-foot normalisation would amplify noise into false
   * contacts.
   */
  perFoot?: boolean;
  /**
   * Drop this many frames from each end of every contact interval.
   *
   * Heel strike and toe-off are genuinely moving, so the first and last frames
   * of a contact are the worst ones to measure stillness against. Trimming
   * keeps only the confident middle.
   */
  trimFrames?: number;
}

export interface FootContactFrame {
  /** Hip-relative height of this foot's lowest contact point. */
  height: number;
  down: boolean;
}

export interface ContactResult {
  left: FootContactFrame[];
  right: FootContactFrame[];
  /** Contact intervals as [startFrame, endFrameInclusive]. */
  intervals: { side: FootSide; start: number; end: number }[];
  /** Fraction of frames with at least one foot down. Near 1 for walking. */
  groundedRatio: number;
  /** The height range the thresholds were derived from. */
  heightRange: { min: number; max: number };
}

/** Hip-relative height of a foot's lowest contact point, in the app's Y-up frame. */
function footHeight(frame: NormalizedLandmark[], heel: number, toe: number): number {
  const hipY = (frame[LM.LEFT_HIP].y + frame[LM.RIGHT_HIP].y) / 2;
  // MediaPipe Y points DOWN; the app's frame negates it.
  const heelY = -(frame[heel].y - hipY);
  const toeY = -(frame[toe].y - hipY);
  return Math.min(heelY, toeY);
}

/**
 * Find which foot is on the ground, per frame.
 *
 * Thresholds are derived from the clip's own foot-height range rather than
 * fixed, so the detector does not need retuning for a different subject,
 * camera distance or frame size.
 */
export function detectContacts(
  worldFrames: (NormalizedLandmark[] | null | undefined)[],
  options: ContactOptions = {},
): ContactResult {
  const downFraction = options.downFraction ?? 0.35;
  const upFraction = options.upFraction ?? 0.55;
  const minFrames = options.minFrames ?? 2;

  const heights = worldFrames.map((frame) => {
    if (!frame || frame.length < 33) return null;
    return {
      left: footHeight(frame, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX),
      right: footHeight(frame, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX),
    };
  });

  const all = heights.flatMap((h) => (h ? [h.left, h.right] : []));
  if (all.length === 0) {
    return {
      left: [], right: [], intervals: [], groundedRatio: 0,
      heightRange: { min: 0, max: 0 },
    };
  }
  const min = Math.min(...all);
  const max = Math.max(...all);

  const perFoot = options.perFoot ?? true;
  const thresholdsFor = (side: FootSide) => {
    const values = perFoot
      ? heights.flatMap((h) => (h ? [side === "left" ? h.left : h.right] : []))
      : all;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const range = Math.max(hi - lo, 1e-6);
    return { downAt: lo + range * downFraction, upAt: lo + range * upFraction };
  };

  const build = (side: FootSide): FootContactFrame[] => {
    const { downAt, upAt } = thresholdsFor(side);
    const out: FootContactFrame[] = [];
    let wasDown = false;
    for (const h of heights) {
      if (!h) {
        out.push({ height: Number.NaN, down: false });
        wasDown = false;
        continue;
      }
      const height = side === "left" ? h.left : h.right;
      // Hysteresis: a foot that is already down needs to rise past the higher
      // threshold before it counts as lifted. Without it a foot hovering near
      // one threshold flickers, producing dozens of one-frame contacts.
      const down: boolean = wasDown ? height < upAt : height < downAt;
      out.push({ height, down });
      wasDown = down;
    }
    return out;
  };

  const left = build("left");
  const right = build("right");

  const trim = options.trimFrames ?? 0;
  const intervals: ContactResult["intervals"] = [];
  const push = (side: FootSide, start: number, end: number) => {
    const s2 = start + trim;
    const e2 = end - trim;
    if (e2 - s2 + 1 >= minFrames) intervals.push({ side, start: s2, end: e2 });
  };
  for (const [side, series] of [["left", left], ["right", right]] as const) {
    let start = -1;
    series.forEach((f, i) => {
      if (f.down && start < 0) start = i;
      if (!f.down && start >= 0) {
        if (i - start >= minFrames) push(side, start, i - 1);
        start = -1;
      }
    });
    if (start >= 0 && series.length - start >= minFrames) {
      push(side, start, series.length - 1);
    }
  }
  intervals.sort((a, b) => a.start - b.start);

  // Drop contacts too short to be real, then recompute the per-frame flags so
  // the two views cannot disagree.
  const keep = new Set<string>();
  for (const interval of intervals) {
    for (let i = interval.start; i <= interval.end; i += 1) keep.add(`${interval.side}:${i}`);
  }
  left.forEach((f, i) => { f.down = keep.has(`left:${i}`); });
  right.forEach((f, i) => { f.down = keep.has(`right:${i}`); });

  const grounded = left.filter((f, i) => f.down || right[i].down).length;

  return {
    left,
    right,
    intervals,
    groundedRatio: left.length > 0 ? grounded / left.length : 0,
    heightRange: { min, max },
  };
}

/**
 * Root translation from detected contacts.
 *
 * While a foot is down it is stationary in the world, so the body's velocity
 * is the negative of that foot's hip-relative velocity. Integrating gives a
 * root trajectory consistent with the legs by construction, with no camera
 * model, focal length or assumed body proportions.
 *
 * The contact points are smoothed HARDER than the pose before differentiating.
 * Heel and toe are the noisiest landmarks MediaPipe produces, and this
 * integrates their velocity, so their noise accumulates directly into the
 * result. Measured on the reference clip, raw hip-relative heel velocity swung
 * between 0.48 and 1.52 m/s within a single stance phase that should have been
 * roughly constant.
 */
export function solveRootFromContacts(
  worldFrames: (NormalizedLandmark[] | null | undefined)[],
  contacts: ContactResult,
  fps: number,
  options: { smoothWindow?: number } = {},
): { translations: THREE.Vector3[]; solvedFrames: number } {
  const dt = fps > 0 ? 1 / fps : 1 / 30;
  const window = options.smoothWindow ?? 5;

  const points = (["left", "right"] as const).map((side) => {
    const heel = side === "left" ? LM.LEFT_HEEL : LM.RIGHT_HEEL;
    const toe = side === "left" ? LM.LEFT_FOOT_INDEX : LM.RIGHT_FOOT_INDEX;
    const series = worldFrames.map((frame) => {
      if (!frame || frame.length < 33) return null;
      const hx = (frame[LM.LEFT_HIP].x + frame[LM.RIGHT_HIP].x) / 2;
      const hy = (frame[LM.LEFT_HIP].y + frame[LM.RIGHT_HIP].y) / 2;
      const hz = (frame[LM.LEFT_HIP].z + frame[LM.RIGHT_HIP].z) / 2;
      // Midpoint of heel and toe: steadier than either alone, and it is the
      // part of the foot that stays put through the heel-to-toe roll.
      return new THREE.Vector3(
        -((frame[heel].x + frame[toe].x) / 2 - hx),
        -((frame[heel].y + frame[toe].y) / 2 - hy),
        (frame[heel].z + frame[toe].z) / 2 - hz,
      );
    });
    return smoothSeries(series, window);
  });

  const translations: THREE.Vector3[] = [new THREE.Vector3()];
  let solvedFrames = 0;

  for (let i = 1; i < worldFrames.length; i += 1) {
    const active: THREE.Vector3[] = [];
    ([contacts.left, contacts.right] as const).forEach((series, side) => {
      if (!series[i]?.down || !series[i - 1]?.down) return;
      const now = points[side][i];
      const prev = points[side][i - 1];
      if (!now || !prev) return;
      active.push(now.clone().sub(prev).divideScalar(dt));
    });

    if (active.length === 0) {
      // Airborne, or the contact just started: hold the last velocity rather
      // than stalling, so a jump does not freeze the character mid-air.
      const previous = i >= 2
        ? translations[i - 1].clone().sub(translations[i - 2])
        : new THREE.Vector3();
      translations.push(translations[i - 1].clone().add(previous));
      continue;
    }

    solvedFrames += 1;
    const velocity = active
      .reduce((sum, v) => sum.add(v), new THREE.Vector3())
      .divideScalar(active.length)
      .negate();
    translations.push(translations[i - 1].clone().add(velocity.multiplyScalar(dt)));
  }

  return { translations, solvedFrames };
}

/**
 * Root translation solved from the POSED RIG's own feet.
 *
 * The variants above derive the root from landmark motion, which leaves a
 * scale mismatch: the rig's legs are rarely the performer's length, so its
 * feet sweep a different distance per stride and the root under- or
 * over-cancels. Measured on the reference clip, a landmark-derived root barely
 * beat having no root at all (30.7 mm mean foot slide against 33.6 mm), and
 * correcting by the hip-height ratio made it worse rather than better.
 *
 * Taking the velocity from the rig's own feet removes the mismatch by
 * construction: whatever the rig's proportions, the contact foot's motion is
 * exactly what has to be cancelled. It needs the poses solved first, so it is
 * a second pass.
 *
 * @param hipsRelative Per frame, each foot's position relative to the hips, in
 *   RIG units, taken from the posed rig.
 */
export function solveRootFromRigFeet(
  hipsRelative: { left: THREE.Vector3; right: THREE.Vector3 }[],
  contacts: ContactResult,
  fps: number,
): { translations: THREE.Vector3[]; solvedFrames: number } {
  const dt = fps > 0 ? 1 / fps : 1 / 30;
  const translations: THREE.Vector3[] = [new THREE.Vector3()];
  let solvedFrames = 0;

  for (let i = 1; i < hipsRelative.length; i += 1) {
    const active: THREE.Vector3[] = [];
    if (contacts.left[i]?.down && contacts.left[i - 1]?.down) {
      active.push(hipsRelative[i].left.clone().sub(hipsRelative[i - 1].left).divideScalar(dt));
    }
    if (contacts.right[i]?.down && contacts.right[i - 1]?.down) {
      active.push(hipsRelative[i].right.clone().sub(hipsRelative[i - 1].right).divideScalar(dt));
    }

    if (active.length === 0) {
      // Airborne: carry the last velocity so the character does not freeze.
      const previous = i >= 2
        ? translations[i - 1].clone().sub(translations[i - 2])
        : new THREE.Vector3();
      translations.push(translations[i - 1].clone().add(previous));
      continue;
    }

    solvedFrames += 1;
    const velocity = active
      .reduce((sum, v) => sum.add(v), new THREE.Vector3())
      .divideScalar(active.length)
      .negate();
    translations.push(translations[i - 1].clone().add(velocity.multiplyScalar(dt)));
  }

  return { translations, solvedFrames };
}

/** Symmetric moving average over a series that may contain gaps. */
function smoothSeries(
  series: (THREE.Vector3 | null)[],
  window: number,
): (THREE.Vector3 | null)[] {
  if (window < 2) return series;
  const half = Math.floor(window / 2);
  return series.map((value, i) => {
    if (!value) return null;
    const acc = new THREE.Vector3();
    let n = 0;
    for (let k = i - half; k <= i + half; k += 1) {
      const other = series[k];
      if (k < 0 || k >= series.length || !other) continue;
      acc.add(other);
      n += 1;
    }
    return n > 0 ? acc.divideScalar(n) : value.clone();
  });
}

/**
 * The vertical offset that puts the character's feet on the floor.
 *
 * Monocular recovery has no idea where the floor is: the hips are placed by
 * whatever the root solve produced, and the feet land wherever the leg
 * rotations put them. For a sprite sheet that matters directly - every frame is
 * composited against the same tile, so a clip that floats or sinks reads as a
 * character skating above the ground or buried in it, no matter how good the
 * pose is.
 *
 * NOT a foot-slide fix, and the plan was wrong to list it as one. Foot slide is
 * `hypot(dx, dz)` between consecutive contact frames - purely horizontal - so a
 * uniform vertical offset cannot change it by a single micron. This is a
 * separate, visual defect with a separate remedy.
 *
 * A low PERCENTILE rather than the outright minimum, because the minimum is set
 * by the single worst-reconstructed frame in the clip and one bad ankle would
 * bury the character for every other frame. The residual dip below zero is
 * returned so the caller can report it rather than discover it by eye.
 *
 * @param footY Per frame, the world Y of each foot's contact point, in rig units.
 * @param contacts Which feet are down; only planted frames define the floor.
 * @returns The offset to ADD to the root's Y.
 */
export function solveGroundOffset(
  footY: { left: number; right: number }[],
  contacts: ContactResult,
  options: { percentile?: number } = {},
): { offset: number; sampledFrames: number; lowestAfterOffset: number } {
  const percentile = options.percentile ?? 0.1;

  const planted: number[] = [];
  footY.forEach((f, i) => {
    if (contacts.left[i]?.down) planted.push(f.left);
    if (contacts.right[i]?.down) planted.push(f.right);
  });

  // With no contact at all - a clip of someone seated, or filmed waist-up -
  // there is no observed floor to align to. Guessing one from airborne feet
  // would place the character by whichever frame happened to reach lowest.
  const samples = planted.length > 0 ? planted : [];
  if (samples.length === 0) return { offset: 0, sampledFrames: 0, lowestAfterOffset: 0 };

  samples.sort((a, b) => a - b);
  const index = Math.min(samples.length - 1, Math.floor(percentile * samples.length));
  const floor = samples[index];

  const lowestOverall = Math.min(
    ...footY.flatMap((f) => [f.left, f.right]).filter((v) => Number.isFinite(v)),
  );
  return {
    offset: -floor,
    sampledFrames: planted.length,
    lowestAfterOffset: lowestOverall - floor,
  };
}
