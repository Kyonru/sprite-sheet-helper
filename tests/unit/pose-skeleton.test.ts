import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { JointPositions } from "../../src/utils/mediapipe-to-bones";
import {
  applyFixedSkeleton,
  segmentLengthVariation,
  solveFixedSkeleton,
} from "../../src/utils/pose-skeleton";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * A deliberately plain upright skeleton. Every limb points along an axis so a
 * failure reads as a wrong number rather than a wrong-looking pose.
 */
function makeJoints(scale = 1): JointPositions {
  const s = scale;
  return {
    hipCenter: v(0, 0, 0),
    shoulderCenter: v(0, 0.5 * s, 0),
    leftHip: v(-0.1 * s, 0, 0),
    rightHip: v(0.1 * s, 0, 0),
    leftShoulder: v(-0.2 * s, 0.5 * s, 0),
    rightShoulder: v(0.2 * s, 0.5 * s, 0),
    leftElbow: v(-0.2 * s, 0.2 * s, 0),
    rightElbow: v(0.2 * s, 0.2 * s, 0),
    leftWrist: v(-0.2 * s, -0.05 * s, 0),
    rightWrist: v(0.2 * s, -0.05 * s, 0),
    leftKnee: v(-0.1 * s, -0.45 * s, 0),
    rightKnee: v(0.1 * s, -0.45 * s, 0),
    leftAnkle: v(-0.1 * s, -0.85 * s, 0),
    rightAnkle: v(0.1 * s, -0.85 * s, 0),
    leftHeel: v(-0.1 * s, -0.9 * s, -0.03 * s),
    rightHeel: v(0.1 * s, -0.9 * s, -0.03 * s),
    leftFootIndex: v(-0.1 * s, -0.9 * s, 0.12 * s),
    rightFootIndex: v(0.1 * s, -0.9 * s, 0.12 * s),
    nose: v(0, 0.75 * s, 0.08 * s),
    earCenter: v(0, 0.76 * s, 0),
  };
}

describe("solveFixedSkeleton", () => {
  it("takes the median length, not the mean, so a bad frame cannot drag it", () => {
    // Four good frames at scale 1 and one wildly mis-detected frame.
    const frames = [makeJoints(1), makeJoints(1), makeJoints(1), makeJoints(1), makeJoints(5)];
    const lengths = solveFixedSkeleton(frames, { symmetric: false });
    // Median of [0.4,0.4,0.4,0.4,2.0] is 0.4; the mean would be 0.72.
    expect(lengths.leftUpLeg).toBeCloseTo(0.45, 6);
    expect(lengths.leftLowerLeg).toBeCloseTo(0.4, 6);
  });

  it("averages left and right when symmetry is enforced", () => {
    const j = makeJoints();
    // Foreshorten the left forearm, as an occluded far limb would be.
    j.leftWrist = v(-0.2, 0.1, 0);
    const asym = solveFixedSkeleton([j], { symmetric: false });
    const sym = solveFixedSkeleton([j], { symmetric: true });

    expect(asym.leftForeArm).toBeCloseTo(0.1, 6);
    expect(asym.rightForeArm).toBeCloseTo(0.25, 6);
    expect(sym.leftForeArm).toBeCloseTo(0.175, 6);
    expect(sym.rightForeArm).toBeCloseTo(0.175, 6);
  });

  it("is symmetric by default", () => {
    const j = makeJoints();
    j.leftWrist = v(-0.2, 0.1, 0);
    const lengths = solveFixedSkeleton([j]);
    expect(lengths.leftForeArm).toBeCloseTo(lengths.rightForeArm, 12);
  });
});

describe("segmentLengthVariation", () => {
  it("reports zero for a rigid skeleton", () => {
    const variation = segmentLengthVariation([makeJoints(), makeJoints(), makeJoints()]);
    for (const value of Object.values(variation)) expect(value).toBeCloseTo(0, 12);
  });

  it("reports the deviation as a fraction of the median", () => {
    const a = makeJoints();
    const b = makeJoints();
    b.leftAnkle = v(-0.1, -0.89, 0); // shin 0.44 instead of 0.40

    // Half the frames long, half short: lengths [0.40, 0.40, 0.44, 0.44] have
    // median 0.42 and every sample 0.02 away from it.
    expect(segmentLengthVariation([a, a, b, b]).leftLowerLeg).toBeCloseTo(0.02 / 0.42, 6);

    // One outlier among three is absorbed entirely - deviations of
    // [0.04, 0, 0] have a median of 0. That is the point of a MAD, and it is
    // why the fixed skeleton uses one: a few badly detected frames must not
    // move the solved length.
    expect(segmentLengthVariation([a, b, a]).leftLowerLeg).toBeCloseTo(0, 9);
  });
});

describe("applyFixedSkeleton", () => {
  it("forces every segment to the solved length", () => {
    const lengths = solveFixedSkeleton([makeJoints()], { symmetric: false });
    // A frame whose limbs point the same way but are 30% too short.
    const shrunk = makeJoints(0.7);
    const fixed = applyFixedSkeleton(shrunk, lengths);

    expect(fixed.shoulderCenter.distanceTo(fixed.hipCenter)).toBeCloseTo(lengths.spine, 6);
    expect(fixed.leftKnee.distanceTo(fixed.leftHip)).toBeCloseTo(lengths.leftUpLeg, 6);
    expect(fixed.leftAnkle.distanceTo(fixed.leftKnee)).toBeCloseTo(lengths.leftLowerLeg, 6);
    expect(fixed.rightWrist.distanceTo(fixed.rightElbow)).toBeCloseTo(lengths.rightForeArm, 6);
  });

  it("preserves every re-projected segment's DIRECTION exactly", () => {
    // This is the whole reason the fixed skeleton cannot change a
    // direction-driven solve: it moves joints only along the vector that was
    // already observed. Measured through the benchmark,
    // `--fixed-skeleton --skeleton-no-feet` is bit-identical to no skeleton
    // at all - 225.50 deg/s2 jitter and 5.4852 deg reference error either way.
    const j = makeJoints();
    j.leftKnee = v(-0.3, -0.3, 0.1);
    const lengths = solveFixedSkeleton([makeJoints()], { symmetric: false });
    const fixed = applyFixedSkeleton(j, lengths);

    const before = j.leftKnee.clone().sub(j.leftHip).normalize();
    const after = fixed.leftKnee.clone().sub(fixed.leftHip).normalize();
    expect(after.dot(before)).toBeCloseTo(1, 9);
  });

  it("changes the heel->toe direction, which is what the solve actually feels", () => {
    // The foot is driven heel -> toe, and those two are siblings re-projected
    // from the ankle by DIFFERENT lengths, so their difference vector rotates.
    const lengths = solveFixedSkeleton([makeJoints()], { symmetric: false });
    const j = makeJoints();
    j.leftHeel = v(-0.1, -0.95, -0.10);
    const fixed = applyFixedSkeleton(j, lengths);

    const before = j.leftFootIndex.clone().sub(j.leftHeel).normalize();
    const after = fixed.leftFootIndex.clone().sub(fixed.leftHeel).normalize();
    expect(after.dot(before)).toBeLessThan(0.999);
  });

  it("leaves the feet observed when asked, which makes it fully inert", () => {
    const lengths = solveFixedSkeleton([makeJoints()], { symmetric: false });
    const j = makeJoints();
    j.leftHeel = v(-0.1, -0.95, -0.1);
    const fixed = applyFixedSkeleton(j, lengths, { feet: false });
    expect(fixed.leftHeel.distanceTo(j.leftHeel)).toBeCloseTo(0, 12);
    expect(fixed.leftFootIndex.distanceTo(j.leftFootIndex)).toBeCloseTo(0, 12);
  });

  it("keeps a degenerate segment where it was rather than inventing an axis", () => {
    const lengths = solveFixedSkeleton([makeJoints()], { symmetric: false });
    const j = makeJoints();
    j.leftWrist = j.leftElbow.clone();
    const fixed = applyFixedSkeleton(j, lengths);
    expect(fixed.leftWrist.distanceTo(fixed.leftElbow)).toBeCloseTo(0, 12);
    expect(Number.isFinite(fixed.leftWrist.x)).toBe(true);
  });
});
