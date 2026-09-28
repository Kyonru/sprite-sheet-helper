import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { JointPositions } from "../../src/utils/mediapipe-to-bones";
import {
  getHeldPoseBoneKeys,
  restoreAxisDepth,
  solveAcrossAxis,
} from "../../src/utils/pose-solve";
import { yawAmplitudeDeg } from "../../src/utils/pose-metrics";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function joints(over: Partial<JointPositions> = {}): JointPositions {
  const base = {
    hipCenter: v(0, 0, 0),
    shoulderCenter: v(0, 0.5, 0),
    leftHip: v(-0.1, 0, 0),
    rightHip: v(0.1, 0, 0),
    leftShoulder: v(-0.2, 0.5, 0),
    rightShoulder: v(0.2, 0.5, 0),
    leftElbow: v(-0.2, 0.2, 0),
    rightElbow: v(0.2, 0.2, 0),
    leftWrist: v(-0.2, -0.05, 0),
    rightWrist: v(0.2, -0.05, 0),
    leftKnee: v(-0.1, -0.45, 0),
    rightKnee: v(0.1, -0.45, 0),
    leftAnkle: v(-0.1, -0.85, 0),
    rightAnkle: v(0.1, -0.85, 0),
    leftHeel: v(-0.1, -0.9, -0.03),
    rightHeel: v(0.1, -0.9, -0.03),
    leftFootIndex: v(-0.1, -0.9, 0.12),
    rightFootIndex: v(0.1, -0.9, 0.12),
    nose: v(0, 0.75, 0.08),
    earCenter: v(0, 0.76, 0),
  } satisfies JointPositions;
  return { ...base, ...over };
}

describe("solveAcrossAxis", () => {
  it("is the hip line exactly when the shoulder weight is zero", () => {
    const j = joints({ leftShoulder: v(-0.2, 0.5, 0.3), rightShoulder: v(0.2, 0.5, -0.3) });
    const axis = solveAcrossAxis(j, {}, 0);
    expect(axis.dot(v(1, 0, 0))).toBeCloseTo(1, 9);
  });

  it("blends toward the shoulder line as the weight rises", () => {
    // Shoulders rotated 45 degrees about Y relative to the hips.
    const j = joints({
      leftShoulder: v(-0.14, 0.5, 0.14),
      rightShoulder: v(0.14, 0.5, -0.14),
    });
    const hipOnly = solveAcrossAxis(j, {}, 0);
    const half = solveAcrossAxis(j, {}, 0.5);
    const heavy = solveAcrossAxis(j, {}, 4);

    const angleTo = (a: THREE.Vector3) =>
      (Math.acos(Math.min(1, a.dot(v(1, 0, 0)))) * 180) / Math.PI;
    expect(angleTo(hipOnly)).toBeCloseTo(0, 6);
    expect(angleTo(half)).toBeGreaterThan(angleTo(hipOnly));
    expect(angleTo(heavy)).toBeGreaterThan(angleTo(half));
    // Never past the shoulder line itself.
    expect(angleTo(heavy)).toBeLessThan(45.001);
  });

  it("lets an occluded shoulder pair stop voting", () => {
    const j = joints({
      leftShoulder: v(-0.14, 0.5, 0.14),
      rightShoulder: v(0.14, 0.5, -0.14),
    });
    const seen = solveAcrossAxis(j, { hip: 1, shoulder: 1 }, 1);
    const blind = solveAcrossAxis(j, { hip: 1, shoulder: 0 }, 1);
    expect(blind.dot(v(1, 0, 0))).toBeCloseTo(1, 9);
    expect(seen.dot(v(1, 0, 0))).toBeLessThan(0.999);
  });

  it("keeps the hip line when the shoulders point the opposite way", () => {
    // Averaging these would cancel to a meaningless near-zero axis.
    const j = joints({ leftShoulder: v(0.2, 0.5, 0), rightShoulder: v(-0.2, 0.5, 0) });
    const axis = solveAcrossAxis(j, {}, 1);
    expect(axis.dot(v(1, 0, 0))).toBeCloseTo(1, 9);
  });

  it("falls back to the shoulder line when the hips are degenerate", () => {
    const j = joints({ leftHip: v(0, 0, 0), rightHip: v(0, 0, 0) });
    const axis = solveAcrossAxis(j, {}, 0.5);
    expect(axis.dot(v(1, 0, 0))).toBeCloseTo(1, 9);
    expect(axis.length()).toBeCloseTo(1, 9);
  });

  it("returns a unit axis even when everything is degenerate", () => {
    const j = joints({
      leftHip: v(0, 0, 0),
      rightHip: v(0, 0, 0),
      leftShoulder: v(0, 0.5, 0),
      rightShoulder: v(0, 0.5, 0),
    });
    expect(solveAcrossAxis(j, {}, 0.5).length()).toBeCloseTo(1, 9);
  });
});

describe("getHeldPoseBoneKeys", () => {
  const landmarks = (visibility?: number) =>
    Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      ...(visibility === undefined ? {} : { visibility }),
    }));

  it("uses the separate confidence landmarks MediaPipe reports in screen space", () => {
    const world = landmarks();
    const confidence = landmarks(0.99);
    confidence[15].visibility = 0.2;

    expect(getHeldPoseBoneKeys(world)).toEqual([]);
    expect(getHeldPoseBoneKeys(confidence)).toContain("leftForeArm");
    expect(getHeldPoseBoneKeys(confidence)).not.toContain("leftArm");
  });

  it("honours a lower visibility threshold", () => {
    const confidence = landmarks(0.99);
    confidence[15].visibility = 0.2;

    expect(getHeldPoseBoneKeys(confidence, 0.5)).toContain("leftForeArm");
    expect(getHeldPoseBoneKeys(confidence, 0.05)).not.toContain("leftForeArm");
  });
});

describe("restoreAxisDepth", () => {
  it("puts the missing length entirely into depth", () => {
    // Observed 0.2 across with no depth; the true axis is 0.25 long.
    const out = restoreAxisDepth(v(0.2, 0, 0.0), 0.25);
    expect(out.x).toBeCloseTo(0.2, 9);
    expect(out.y).toBeCloseTo(0, 9);
    expect(out.z).toBeCloseTo(0.15, 9); // 0.25^2 - 0.2^2 = 0.15^2
    expect(out.length()).toBeCloseTo(0.25, 9);
  });

  it("keeps the observed sign of depth, the one thing it cannot recover", () => {
    expect(restoreAxisDepth(v(0.2, 0, -0.01), 0.25).z).toBeLessThan(0);
    expect(restoreAxisDepth(v(0.2, 0, 0.01), 0.25).z).toBeGreaterThan(0);
  });

  it("never SHRINKS the depth toward the image plane", () => {
    // A target shorter than the observation means the target is wrong. Shrinking
    // instead of leaving it alone is the failure that drove pelvic yaw from 18
    // degrees peak-to-peak to 46.6 on the reference clip.
    const observed = v(0.05, 0, 0.4);
    expect(restoreAxisDepth(observed, 0.1).z).toBeCloseTo(0.4, 9);
    expect(restoreAxisDepth(observed, 0.2).z).toBeCloseTo(0.4, 9);
  });

  it("does nothing when the in-plane extent already exceeds the target", () => {
    const observed = v(0.4, 0, 0.05);
    expect(restoreAxisDepth(observed, 0.3).equals(observed)).toBe(true);
  });

  it("does nothing for a non-positive target", () => {
    const observed = v(0.2, 0, 0.01);
    expect(restoreAxisDepth(observed, 0).equals(observed)).toBe(true);
    expect(restoreAxisDepth(observed, -1).equals(observed)).toBe(true);
  });
});

describe("yawAmplitudeDeg", () => {
  const yawQuat = (deg: number) =>
    new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), (deg * Math.PI) / 180);

  it("measures peak-to-peak swing about the vertical", () => {
    const { peakToPeakDeg } = yawAmplitudeDeg([-6, -2, 0, 3, 6].map(yawQuat));
    expect(peakToPeakDeg).toBeCloseTo(12, 4);
  });

  it("is independent of which way the performer walks", () => {
    const swing = [-6, -2, 0, 3, 6];
    const a = yawAmplitudeDeg(swing.map(yawQuat));
    const b = yawAmplitudeDeg(swing.map((d) => yawQuat(d + 137)));
    expect(b.peakToPeakDeg).toBeCloseTo(a.peakToPeakDeg, 4);
    expect(b.stdDeg).toBeCloseTo(a.stdDeg, 4);
  });

  it("does not read a full circle for a clip facing near 180 degrees", () => {
    // Without unwrapping, +179 and -179 look 358 degrees apart.
    const { peakToPeakDeg } = yawAmplitudeDeg([176, 179, -179, -176].map(yawQuat));
    expect(peakToPeakDeg).toBeCloseTo(8, 3);
  });

  it("ignores a rotation that leaves no yaw to measure", () => {
    // Forward taken exactly onto the vertical: the ground projection vanishes.
    const flat = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), v(0, 1, 0));
    const { peakToPeakDeg } = yawAmplitudeDeg([flat, yawQuat(0), flat, yawQuat(10)]);
    expect(peakToPeakDeg).toBeCloseTo(10, 4);
  });

  it("returns zero rather than NaN for an empty clip", () => {
    expect(yawAmplitudeDeg([])).toEqual({ peakToPeakDeg: 0, stdDeg: 0 });
  });
});
