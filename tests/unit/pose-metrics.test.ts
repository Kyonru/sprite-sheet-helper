import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  compareBoneDirections,
  computePoseMetrics,
  detectLandmarkDiscontinuities,
  zeroPhaseSmooth,
} from "@/utils/pose-metrics";
import { buildRigRetargetMap } from "@/utils/pose-retargeting";
import { buildPoseDataFromRig } from "@/utils/pose-solve";
import type { PoseFrame } from "@/utils/pose-to-animation";
import type { BoneRemap } from "@/utils/bone-remap";

/**
 * Synthetic rig and poses only — no video, no network, no MediaPipe. These
 * pin down what each metric MEANS, so a future change that makes a number look
 * better without making the animation better gets caught.
 */
function makeRig() {
  const root = new THREE.Object3D();
  root.name = "Armature";
  const chain: Record<string, THREE.Bone> = {};
  const add = (name: string, parent: THREE.Object3D, offset: [number, number, number]) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(...offset);
    parent.add(bone);
    chain[name] = bone;
    return bone;
  };
  const hips = add("mixamorigHips", root, [0, 1, 0]);
  const spine = add("mixamorigSpine", hips, [0, 0.1, 0]);
  const spine1 = add("mixamorigSpine1", spine, [0, 0.1, 0]);
  const spine2 = add("mixamorigSpine2", spine1, [0, 0.1, 0]);
  const neck = add("mixamorigNeck", spine2, [0, 0.1, 0]);
  add("mixamorigHead", neck, [0, 0.15, 0]);
  const lsh = add("mixamorigLeftShoulder", spine2, [0.05, 0.05, 0]);
  const larm = add("mixamorigLeftArm", lsh, [0.1, 0, 0]);
  add("mixamorigLeftForeArm", larm, [0.25, 0, 0]);
  const rsh = add("mixamorigRightShoulder", spine2, [-0.05, 0.05, 0]);
  const rarm = add("mixamorigRightArm", rsh, [-0.1, 0, 0]);
  add("mixamorigRightForeArm", rarm, [-0.25, 0, 0]);
  const lup = add("mixamorigLeftUpLeg", hips, [0.09, 0, 0]);
  const lleg = add("mixamorigLeftLeg", lup, [0, -0.45, 0]);
  add("mixamorigLeftFoot", lleg, [0, -0.45, 0]);
  const rup = add("mixamorigRightUpLeg", hips, [-0.09, 0, 0]);
  const rleg = add("mixamorigRightLeg", rup, [0, -0.45, 0]);
  add("mixamorigRightFoot", rleg, [0, -0.45, 0]);
  root.updateMatrixWorld(true);

  const remap = Object.fromEntries(
    Object.keys(chain).map((name) => [
      name.replace("mixamorig", "").replace(/^([A-Z])/, (m) => m.toLowerCase()),
      name,
    ]),
  );
  // Map to the canonical BoneRemap key names.
  const canonical = {
    hips: "mixamorigHips",
    spine: "mixamorigSpine",
    spine1: "mixamorigSpine1",
    spine2: "mixamorigSpine2",
    neck: "mixamorigNeck",
    head: "mixamorigHead",
    leftShoulder: "mixamorigLeftShoulder",
    rightShoulder: "mixamorigRightShoulder",
    leftArm: "mixamorigLeftArm",
    rightArm: "mixamorigRightArm",
    leftForeArm: "mixamorigLeftForeArm",
    rightForeArm: "mixamorigRightForeArm",
    leftUpLeg: "mixamorigLeftUpLeg",
    rightUpLeg: "mixamorigRightUpLeg",
    leftLeg: "mixamorigLeftLeg",
    rightLeg: "mixamorigRightLeg",
    leftFoot: "mixamorigLeftFoot",
    rightFoot: "mixamorigRightFoot",
  } satisfies BoneRemap;
  void remap;
  return { root, rigMap: buildRigRetargetMap(root, canonical) };
}

function restFrames(count: number, fps = 30): { root: THREE.Object3D; rigMap: ReturnType<typeof makeRig>["rigMap"]; frames: PoseFrame[] } {
  const { root, rigMap } = makeRig();
  const frames: PoseFrame[] = [];
  for (let i = 0; i < count; i += 1) {
    frames.push({ time: i / fps, data: buildPoseDataFromRig(rigMap) });
  }
  return { root, rigMap, frames };
}

describe("computePoseMetrics", () => {
  it("reports zero jitter for a perfectly still pose", () => {
    const { root, rigMap, frames } = restFrames(30);
    const m = computePoseMetrics(root, rigMap, frames, { fps: 30 });
    expect(m.frames).toBe(30);
    expect(m.angularJitterDegPerSec2).toBeCloseTo(0, 6);
    expect(m.rootJitter).toBeCloseTo(0, 9);
    expect(m.quaternionDiscontinuities).toBe(0);
  });

  it("reports near-zero bone-length variance when only rotations change", () => {
    // Rotation-only animation cannot stretch a bone. If this metric ever rises,
    // something is writing bone POSITIONS, which is the fault it exists to catch.
    const { root, rigMap } = makeRig();
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 40; i += 1) {
      const arm = rigMap.bones.get("leftArm");
      arm?.bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i / 5) * 0.8);
      arm?.bone.updateMatrix();
      root.updateMatrixWorld(true);
      frames.push({ time: i / 30, data: buildPoseDataFromRig(rigMap) });
    }
    const m = computePoseMetrics(root, rigMap, frames, { fps: 30 });
    expect(m.boneLengthVariance).toBeLessThan(1e-12);
  });

  it("separates steady rotation from jitter", () => {
    // A bone turning at a constant rate must score far lower than one that
    // alternates, even though the alternating one may travel less overall.
    const build = (fn: (i: number) => number) => {
      const { root, rigMap } = makeRig();
      const frames: PoseFrame[] = [];
      for (let i = 0; i < 40; i += 1) {
        const arm = rigMap.bones.get("leftArm");
        arm?.bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), fn(i));
        arm?.bone.updateMatrix();
        root.updateMatrixWorld(true);
        frames.push({ time: i / 30, data: buildPoseDataFromRig(rigMap) });
      }
      return computePoseMetrics(root, rigMap, frames, { fps: 30 });
    };
    const steady = build((i) => i * 0.02);
    const jittery = build((i) => (i % 2 === 0 ? 0 : 0.12));
    expect(jittery.angularJitterDegPerSec2).toBeGreaterThan(
      steady.angularJitterDegPerSec2 * 5,
    );
  });

  it("counts quaternion sign flips", () => {
    const { root, rigMap } = makeRig();
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 6; i += 1) {
      const data = buildPoseDataFromRig(rigMap);
      if (i % 2 === 1) {
        for (const bone of data.bones) {
          bone.quaternion.set(
            -bone.quaternion.x, -bone.quaternion.y, -bone.quaternion.z, -bone.quaternion.w,
          );
        }
      }
      frames.push({ time: i / 30, data });
    }
    const m = computePoseMetrics(root, rigMap, frames, { fps: 30 });
    expect(m.quaternionDiscontinuities).toBeGreaterThan(0);
  });

  it("reports zero contacts rather than pretending slide is good", () => {
    // A still pose has feet that never move, so with a generous threshold they
    // are always in contact and slide is genuinely zero.
    const { root, rigMap, frames } = restFrames(20);
    const m = computePoseMetrics(root, rigMap, frames, { fps: 30, contactSpeed: 1, contactHeight: 10 });
    expect(m.contactFrames).toBeGreaterThan(0);
    expect(m.footSlideMean).toBeCloseTo(0, 9);
  });

  it("handles degenerate input without throwing", () => {
    const { root, rigMap } = makeRig();
    expect(() => computePoseMetrics(root, rigMap, [], { fps: 30 })).not.toThrow();
    const single = computePoseMetrics(root, rigMap, [{ time: 0, data: buildPoseDataFromRig(rigMap) }], { fps: 30 });
    expect(single.frames).toBe(1);
    expect(single.angularJitterDegPerSec2).toBe(0);
  });

  it("measures a plausible stature", () => {
    const { root, rigMap, frames } = restFrames(2);
    const m = computePoseMetrics(root, rigMap, frames, { fps: 30 });
    // Head at 1.55, feet at 0.10 in the synthetic rig.
    expect(m.statureUnits).toBeGreaterThan(1.3);
    expect(m.statureUnits).toBeLessThan(1.6);
  });
});

describe("compareBoneDirections", () => {
  it("reports zero disagreement between a clip and itself", () => {
    const { root, rigMap, frames } = restFrames(10);
    const world = frames.map(() => {
      const map = new Map<keyof BoneRemap, THREE.Vector3>();
      rigMap.bones.forEach((bd, key) => {
        const p = new THREE.Vector3();
        bd.bone.getWorldPosition(p);
        map.set(key, p);
      });
      return map;
    });
    const roots = frames.map(() => new THREE.Quaternion());
    const result = compareBoneDirections({ world, rootQuats: roots }, { world, rootQuats: roots });
    expect(result.overallMeanDeg).toBeCloseTo(0, 6);
    void root;
  });

  it("is blind to a global facing difference", () => {
    // The whole point: two clips of the same performance can face 191 degrees
    // apart because recovery happens in camera space. Comparing in each clip's
    // own root frame must cancel that entirely.
    const { rigMap, frames } = restFrames(5);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.75);
    const worldA: Map<keyof BoneRemap, THREE.Vector3>[] = [];
    const worldB: Map<keyof BoneRemap, THREE.Vector3>[] = [];
    frames.forEach(() => {
      const a = new Map<keyof BoneRemap, THREE.Vector3>();
      const b = new Map<keyof BoneRemap, THREE.Vector3>();
      rigMap.bones.forEach((bd, key) => {
        const p = new THREE.Vector3();
        bd.bone.getWorldPosition(p);
        a.set(key, p.clone());
        b.set(key, p.clone().applyQuaternion(spin));
      });
      worldA.push(a);
      worldB.push(b);
    });
    const rootsA = frames.map(() => new THREE.Quaternion());
    const rootsB = frames.map(() => spin.clone());
    const result = compareBoneDirections(
      { world: worldA, rootQuats: rootsA },
      { world: worldB, rootQuats: rootsB },
    );
    expect(result.overallMeanDeg).toBeLessThan(1e-4);
  });
});

describe("zeroPhaseSmooth", () => {
  it("introduces no lag on a ramp", () => {
    // The defining property: a causal filter lags a ramp, a zero-phase one
    // does not. This is what makes it usable as a reference for measuring
    // another filter's lag.
    const values = Array.from({ length: 40 }, (_, i) => new THREE.Vector3(i, 0, 0));
    const out = zeroPhaseSmooth(values, 7);
    // Away from the edges the output must sit on the ramp, not behind it.
    for (let i = 8; i < 32; i += 1) {
      expect(out[i].x).toBeCloseTo(values[i].x, 6);
    }
  });

  it("removes alternating noise while preserving the trend", () => {
    const values = Array.from({ length: 40 }, (_, i) =>
      new THREE.Vector3(i * 0.1 + (i % 2 === 0 ? 0.5 : -0.5), 0, 0),
    );
    const out = zeroPhaseSmooth(values, 7);
    // Residual alternation must be far smaller than the +-0.5 input noise.
    for (let i = 8; i < 32; i += 1) {
      expect(Math.abs(out[i].x - i * 0.1)).toBeLessThan(0.1);
    }
  });

  it("is a no-op for degenerate windows and empty input", () => {
    const values = [new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)];
    expect(zeroPhaseSmooth(values, 1)[0].x).toBe(1);
    expect(zeroPhaseSmooth(values, 0)[1].z).toBe(6);
    expect(zeroPhaseSmooth([], 7)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const values = Array.from({ length: 10 }, (_, i) => new THREE.Vector3(i, 0, 0));
    const copy = values.map((v) => v.clone());
    zeroPhaseSmooth(values, 5);
    values.forEach((v, i) => expect(v.equals(copy[i])).toBe(true));
  });
});

describe("detectLandmarkDiscontinuities", () => {
  const still = (n: number, offset = 0) =>
    Array.from({ length: n }, () =>
      Array.from({ length: 33 }, (_, k) => ({ x: k * 0.01 + offset, y: 0, z: 0 })),
    );

  it("finds nothing in continuous motion", () => {
    const frames = Array.from({ length: 40 }, (_, i) =>
      Array.from({ length: 33 }, (_, k) => ({ x: k * 0.01 + i * 0.005, y: 0, z: 0 })),
    );
    expect(detectLandmarkDiscontinuities(frames).events).toHaveLength(0);
  });

  it("finds a frame where every landmark jumps at once", () => {
    const frames = [...still(20, 0), ...still(20, 1.5)];
    const { events } = detectLandmarkDiscontinuities(frames);
    expect(events).toContain(20);
    expect(events).toHaveLength(1);
  });

  it("does not mistake fast continuous motion for a jump", () => {
    // Everything moving quickly but smoothly must not trigger: a jump is an
    // outlier against the clip's OWN motion, not merely a large value.
    const frames = Array.from({ length: 40 }, (_, i) =>
      Array.from({ length: 33 }, (_, k) => ({ x: k * 0.01 + i * 0.15, y: 0, z: 0 })),
    );
    expect(detectLandmarkDiscontinuities(frames).events).toHaveLength(0);
  });

  it("tolerates gaps and short input", () => {
    expect(detectLandmarkDiscontinuities([]).events).toHaveLength(0);
    expect(detectLandmarkDiscontinuities([null, undefined]).events).toHaveLength(0);
    const withGap = [...still(10), null, ...still(10)];
    expect(() => detectLandmarkDiscontinuities(withGap)).not.toThrow();
  });
});
