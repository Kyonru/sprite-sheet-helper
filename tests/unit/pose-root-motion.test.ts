import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import {
  applyRootMotionMode,
  defaultFocalPx,
  recoverRootTranslations,
  solveRootFromFeet,
  solveSegmentLengths,
} from "@/utils/pose-root-motion";

const W = 768;
const H = 432;
const FOCAL = defaultFocalPx(W, H);

const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

function blank(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }) as NormalizedLandmark);
}

/**
 * Project a metric body standing at (X, Y, depth) into normalized screen
 * coordinates using the same pinhole model the recovery inverts. If recovery
 * cannot invert its own projection, nothing else it says can be trusted.
 */
function project(depth: number, worldX = 0, worldY = 0): NormalizedLandmark[] {
  const lm = blank();
  const thigh = 0.4;
  const shin = 0.4;
  const upperArm = 0.3;
  const put = (i: number, mx: number, my: number) => {
    // Inverse of the recovery's mapping: world X is mirrored, world Y is up.
    const u = W / 2 - (mx * FOCAL) / depth;
    const v = H / 2 - (my * FOCAL) / depth;
    lm[i] = { x: u / W, y: v / H, z: 0, visibility: 1 } as NormalizedLandmark;
  };
  put(LM.LEFT_HIP, worldX + 0.1, worldY);
  put(LM.RIGHT_HIP, worldX - 0.1, worldY);
  put(LM.LEFT_KNEE, worldX + 0.1, worldY - thigh);
  put(LM.RIGHT_KNEE, worldX - 0.1, worldY - thigh);
  put(LM.LEFT_ANKLE, worldX + 0.1, worldY - thigh - shin);
  put(LM.RIGHT_ANKLE, worldX - 0.1, worldY - thigh - shin);
  put(LM.LEFT_SHOULDER, worldX + 0.2, worldY + 0.5);
  put(LM.RIGHT_SHOULDER, worldX - 0.2, worldY + 0.5);
  put(LM.LEFT_ELBOW, worldX + 0.2, worldY + 0.5 - upperArm);
  put(LM.RIGHT_ELBOW, worldX - 0.2, worldY + 0.5 - upperArm);
  return lm;
}

function worldFrame(): NormalizedLandmark[] {
  // World landmarks are hip-centred; only the segment LENGTHS matter here.
  const lm = blank();
  const put = (i: number, x: number, y: number) => {
    lm[i] = { x, y, z: 0, visibility: 1 } as NormalizedLandmark;
  };
  put(LM.LEFT_HIP, 0.1, 0);
  put(LM.RIGHT_HIP, -0.1, 0);
  put(LM.LEFT_KNEE, 0.1, -0.4);
  put(LM.RIGHT_KNEE, -0.1, -0.4);
  put(LM.LEFT_ANKLE, 0.1, -0.8);
  put(LM.RIGHT_ANKLE, -0.1, -0.8);
  put(LM.LEFT_SHOULDER, 0.2, 0.5);
  put(LM.RIGHT_SHOULDER, -0.2, 0.5);
  put(LM.LEFT_ELBOW, 0.2, 0.2);
  put(LM.RIGHT_ELBOW, -0.2, 0.2);
  return lm;
}

describe("solveSegmentLengths", () => {
  it("recovers metric segment lengths from world landmarks", () => {
    const lengths = solveSegmentLengths([worldFrame(), worldFrame(), worldFrame()]);
    expect(lengths.get(`${LM.LEFT_HIP}-${LM.LEFT_KNEE}`)).toBeCloseTo(0.4, 6);
    expect(lengths.get(`${LM.LEFT_KNEE}-${LM.LEFT_ANKLE}`)).toBeCloseTo(0.4, 6);
    expect(lengths.get(`${LM.LEFT_SHOULDER}-${LM.LEFT_ELBOW}`)).toBeCloseTo(0.3, 6);
  });

  it("takes the median so one bad frame cannot stretch a bone", () => {
    const bad = worldFrame();
    bad[LM.LEFT_KNEE] = { x: 0.1, y: -9, z: 0, visibility: 1 } as NormalizedLandmark;
    const lengths = solveSegmentLengths([worldFrame(), bad, worldFrame()]);
    expect(lengths.get(`${LM.LEFT_HIP}-${LM.LEFT_KNEE}`)).toBeCloseTo(0.4, 6);
  });

  it("ignores frames without landmarks", () => {
    expect(solveSegmentLengths([null, undefined, worldFrame()]).size).toBeGreaterThan(0);
    expect(solveSegmentLengths([null]).size).toBe(0);
  });
});

describe("recoverRootTranslations", () => {
  const lengths = solveSegmentLengths([worldFrame()]);

  it("inverts its own projection: recovers the depth it was given", () => {
    const { medianDepth } = recoverRootTranslations(
      [project(3.0), project(3.0)],
      lengths,
      { imageWidth: W, imageHeight: H },
    );
    expect(medianDepth).toBeCloseTo(3.0, 3);
  });

  it("recovers horizontal translation, which world landmarks do not contain", () => {
    // The whole reason this module exists.
    const frames = [project(3, 0), project(3, 0.5), project(3, 1.0)];
    const { translations } = recoverRootTranslations(frames, lengths, {
      imageWidth: W, imageHeight: H,
    });
    expect(translations[0].x).toBeCloseTo(0, 6);
    expect(translations[1].x).toBeCloseTo(0.5, 3);
    expect(translations[2].x).toBeCloseTo(1.0, 3);
  });

  it("recovers vertical translation with Y up", () => {
    const { translations } = recoverRootTranslations(
      [project(3, 0, 0), project(3, 0, 0.25)],
      lengths,
      { imageWidth: W, imageHeight: H },
    );
    expect(translations[1].y).toBeCloseTo(0.25, 3);
  });

  it("recovers depth change from apparent size", () => {
    const { translations } = recoverRootTranslations(
      [project(3), project(4)],
      lengths,
      { imageWidth: W, imageHeight: H },
    );
    expect(translations[1].z).toBeCloseTo(1.0, 2);
  });

  it("anchors at the first frame, since absolute depth is an assumption", () => {
    const { translations } = recoverRootTranslations(
      [project(5), project(5)],
      lengths,
      { imageWidth: W, imageHeight: H },
    );
    expect(translations[0].length()).toBeCloseTo(0, 9);
  });

  it("holds through frames with no usable estimate rather than dropping them", () => {
    const frames = [project(3, 0), null, project(3, 0.5)];
    const { translations, gapFrames } = recoverRootTranslations(frames, lengths, {
      imageWidth: W, imageHeight: H,
    });
    expect(translations).toHaveLength(3);
    expect(gapFrames).toBe(1);
    expect(translations[1].x).toBeCloseTo(translations[0].x, 9);
  });

  it("skips segments that are too foreshortened or occluded", () => {
    // All landmarks on top of each other: every segment is sub-pixel.
    const degenerate = blank();
    for (let i = 0; i < 33; i += 1) degenerate[i] = { x: 0.5, y: 0.5, z: 0, visibility: 1 } as NormalizedLandmark;
    const { translations, gapFrames } = recoverRootTranslations(
      [project(3), degenerate],
      lengths,
      { imageWidth: W, imageHeight: H },
    );
    expect(gapFrames).toBe(1);
    expect(translations[1].x).toBeCloseTo(translations[0].x, 9);

    // And an occluded pair must not contribute.
    const occluded = project(3);
    for (const i of Object.values(LM)) occluded[i] = { ...occluded[i], visibility: 0.1 } as NormalizedLandmark;
    const result = recoverRootTranslations([occluded], lengths, { imageWidth: W, imageHeight: H });
    expect(result.gapFrames).toBe(1);
  });

  it("uses a focal length of 0.75x the longest side by default", () => {
    expect(defaultFocalPx(768, 432)).toBeCloseTo(576, 6);
  });
});

describe("applyRootMotionMode", () => {
  const track = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0.1, 0.5),
    new THREE.Vector3(2, 0.2, 1.0),
  ];

  it("preserve keeps all three axes", () => {
    const out = applyRootMotionMode(track, { mode: "preserve" });
    expect(out[2].x).toBeCloseTo(2, 9);
    expect(out[2].y).toBeCloseTo(0.2, 9);
    expect(out[2].z).toBeCloseTo(1.0, 9);
  });

  it("in-place removes horizontal motion but keeps the vertical bob", () => {
    // The bob is what carries the weight of a step; removing it too would
    // leave the character gliding.
    const out = applyRootMotionMode(track, { mode: "in-place" });
    expect(out[2].x).toBe(0);
    expect(out[2].z).toBe(0);
    expect(out[2].y).toBeCloseTo(0.2, 9);
  });

  it("scaled multiplies by the target/source hip-height ratio", () => {
    const out = applyRootMotionMode(track, {
      mode: "scaled",
      sourceHipHeight: 0.9,
      targetHipHeight: 1.8,
    });
    expect(out[2].x).toBeCloseTo(4, 9);
  });

  it("scaled falls back to 1:1 when a hip height is unknown", () => {
    const out = applyRootMotionMode(track, { mode: "scaled", sourceHipHeight: 0 });
    expect(out[2].x).toBeCloseTo(2, 9);
  });

  it("converts metres to rig units", () => {
    // A rig authored in centimetres has 0.01 metres per unit.
    const out = applyRootMotionMode(track, { mode: "preserve", metresPerUnit: 0.01 });
    expect(out[2].x).toBeCloseTo(200, 6);
  });

  it("ignores a nonsensical unit scale rather than producing infinities", () => {
    const out = applyRootMotionMode(track, { mode: "preserve", metresPerUnit: 0 });
    expect(Number.isFinite(out[2].x)).toBe(true);
    expect(out[2].x).toBeCloseTo(2, 9);
  });

  it("does not mutate its input", () => {
    const copy = track.map((v) => v.clone());
    applyRootMotionMode(track, { mode: "in-place" });
    track.forEach((v, i) => expect(v.equals(copy[i])).toBe(true));
  });
});

describe("solveRootFromFeet", () => {
  const FPS = 30;

  /**
   * A treadmill-style walk: the body advances at a constant speed and one foot
   * is always planted, so in hip-relative terms the planted foot slides
   * backwards at exactly the body speed. Recovering that speed is the whole
   * job.
   */
  function walk(frames: number, speed: number): NormalizedLandmark[][] {
    return Array.from({ length: frames }, (_, i) => {
      const lm = blank();
      const t = i / FPS;
      // Hips at the origin: world landmarks are hip-centred.
      lm[LM.LEFT_HIP] = { x: 0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      lm[LM.RIGHT_HIP] = { x: -0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      // Left foot planted and low; MediaPipe y is DOWN, so planted = larger y.
      // It slides backwards relative to the hips at the body speed. Sliding
      // toward MediaPipe +x (camera right) means the body travels camera-LEFT,
      // which is +x once landmarksToJointPositions mirrors the axis.
      const slide = speed * t;
      for (const i2 of [LM.LEFT_ANKLE, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX]) {
        lm[i2] = { x: 0.1 + slide, y: 0.85, z: 0, visibility: 1 } as NormalizedLandmark;
      }
      // Right foot lifted well clear, so it must not influence the result.
      for (const i2 of [LM.RIGHT_ANKLE, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX]) {
        lm[i2] = { x: -0.1 - slide, y: 0.55, z: 0, visibility: 1 } as NormalizedLandmark;
      }
      return lm;
    });
  }

  it("recovers body speed from the planted foot, with no camera model", () => {
    const frames = walk(31, 1.0); // 1 m/s for ~1 second
    const { translations } = solveRootFromFeet(frames, FPS);
    // +x in the app frame: the mirror flips the direction of travel.
    expect(translations[30].x).toBeCloseTo(1.0, 2);
    expect(translations[0].length()).toBeCloseTo(0, 9);
  });

  it("ignores the lifted foot", () => {
    // The right foot moves the opposite way and twice as fast. If it were
    // being averaged in, the recovered speed would be badly wrong.
    const frames = walk(31, 1.0);
    const { translations } = solveRootFromFeet(frames, FPS);
    expect(translations[30].x).toBeCloseTo(1.0, 2);
  });

  it("scales with the body speed", () => {
    const slow = solveRootFromFeet(walk(31, 0.5), FPS).translations[30].x;
    const fast = solveRootFromFeet(walk(31, 2.0), FPS).translations[30].x;
    expect(fast / slow).toBeCloseTo(4, 1);
  });

  it("holds through frames with no landmarks", () => {
    const frames: (NormalizedLandmark[] | null)[] = walk(10, 1.0);
    frames[5] = null;
    const { translations, plantedFrames } = solveRootFromFeet(frames, FPS);
    expect(translations).toHaveLength(10);
    expect(plantedFrames).toBeLessThan(10);
    translations.forEach((t) => expect(Number.isFinite(t.x)).toBe(true));
  });

  it("returns a zero-anchored track starting at the origin", () => {
    const { translations } = solveRootFromFeet(walk(20, 1.0), FPS);
    expect(translations[0].x).toBe(0);
    expect(translations[0].y).toBe(0);
    expect(translations[0].z).toBe(0);
  });

  it("handles a standing subject as no motion", () => {
    const { translations } = solveRootFromFeet(walk(20, 0), FPS);
    expect(Math.abs(translations[19].x)).toBeLessThan(1e-6);
  });
});
