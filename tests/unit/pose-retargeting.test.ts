import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { MIXAMO_DEFAULT_REMAP, type BoneRemap } from "@/utils/bone-remap";
import type { PoseBoneData } from "@/utils/mediapipe-to-bones";
import {
  applyPoseCalibration,
  applyRetargetedPose,
  buildPoseCalibration,
  buildPreferredNamedObjectMap,
  buildRigRetargetMap,
  clampAnatomicalPose,
  scorePoseLandmarks,
  selectBestPoseCandidate,
} from "@/utils/pose-retargeting";

function landmark(
  x: number,
  y: number,
  z = 0,
  visibility = 1,
): NormalizedLandmark {
  return { x, y, z, visibility };
}

function makeGoodLandmarks() {
  const lm = Array.from({ length: 33 }, () => landmark(0.5, 0.5));
  lm[0] = landmark(0.5, 0.1);
  lm[11] = landmark(0.4, 0.25);
  lm[12] = landmark(0.6, 0.25);
  lm[13] = landmark(0.32, 0.42);
  lm[14] = landmark(0.68, 0.42);
  lm[15] = landmark(0.28, 0.6);
  lm[16] = landmark(0.72, 0.6);
  lm[23] = landmark(0.43, 0.55);
  lm[24] = landmark(0.57, 0.55);
  lm[25] = landmark(0.4, 0.75);
  lm[26] = landmark(0.6, 0.75);
  lm[27] = landmark(0.4, 0.95);
  lm[28] = landmark(0.6, 0.95);
  lm[31] = landmark(0.39, 0.98);
  lm[32] = landmark(0.61, 0.98);
  return lm;
}

function expectQuaternionClose(
  actual: THREE.Quaternion,
  expected: THREE.Quaternion,
) {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
  expect(actual.w).toBeCloseTo(expected.w);
}

function makeRig(remapPatch: Partial<BoneRemap> = {}) {
  const remap = { ...MIXAMO_DEFAULT_REMAP, ...remapPatch };
  const root = new THREE.Object3D();
  root.name = "root";
  return { root, remap };
}

describe("pose retargeting utilities", () => {
  it("composes direction deltas with each bone rest quaternion", () => {
    const { root, remap } = makeRig({
      leftArm: "upper",
      leftForeArm: "fore",
    });
    const upper = new THREE.Object3D();
    upper.name = "upper";
    upper.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const fore = new THREE.Object3D();
    fore.name = "fore";
    fore.position.set(0, 1, 0);
    upper.add(fore);
    root.add(upper);
    root.updateMatrixWorld(true);

    const rigMap = buildRigRetargetMap(root, remap);
    const bone = rigMap.bones.get("leftArm")!;
    applyRetargetedPose(
      bone,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    );

    expectQuaternionClose(bone.bone.quaternion, bone.restQuat);
  });

  it("chooses the mapped skeleton child instead of the first named child", () => {
    const { root, remap } = makeRig({
      leftArm: "upper",
      leftForeArm: "fore",
    });
    const upper = new THREE.Object3D();
    upper.name = "upper";
    const decoy = new THREE.Object3D();
    decoy.name = "decoy";
    decoy.position.set(2, 0, 0);
    const fore = new THREE.Object3D();
    fore.name = "fore";
    fore.position.set(0, -1, 0);
    upper.add(decoy);
    upper.add(fore);
    root.add(upper);

    const rigMap = buildRigRetargetMap(root, remap);
    const bone = rigMap.bones.get("leftArm")!;

    expect(bone.childName).toBe("fore");
    expect(bone.restDir.y).toBeCloseTo(-1);
  });

  it("prefers usable skeleton bones when an FBX contains duplicate bone names", () => {
    const { root, remap } = makeRig({
      leftArm: "mixamorigLeftArm",
      leftForeArm: "mixamorigLeftForeArm",
    });
    const realUpper = new THREE.Bone();
    realUpper.name = "mixamorigLeftArm";
    realUpper.position.set(1, 2, 0);
    const realFore = new THREE.Bone();
    realFore.name = "mixamorigLeftForeArm";
    realFore.position.set(0, 10, 0);
    realUpper.add(realFore);

    const inertUpper = new THREE.Bone();
    inertUpper.name = "mixamorigLeftArm";
    const inertFore = new THREE.Bone();
    inertFore.name = "mixamorigLeftForeArm";

    root.add(realUpper);
    root.add(inertUpper);
    root.add(inertFore);

    const named = buildPreferredNamedObjectMap(root);
    const rigMap = buildRigRetargetMap(root, remap);

    expect(named.get("mixamorigLeftArm")).toBe(realUpper);
    expect(rigMap.bones.get("leftArm")?.bone).toBe(realUpper);
    expect(rigMap.bones.get("leftArm")?.child).toBe(realFore);
  });

  it("handles T-pose, A-pose, bent limb, and missing-child targets", () => {
    const { root, remap } = makeRig({
      leftArm: "upper",
      leftForeArm: "fore",
      leftUpLeg: "thigh",
      leftLeg: "shin",
      head: "head",
    });
    const upper = new THREE.Object3D();
    upper.name = "upper";
    const fore = new THREE.Object3D();
    fore.name = "fore";
    fore.position.set(1, 0, 0);
    upper.add(fore);
    const thigh = new THREE.Object3D();
    thigh.name = "thigh";
    const shin = new THREE.Object3D();
    shin.name = "shin";
    shin.position.set(0, -1, 0);
    thigh.add(shin);
    const head = new THREE.Object3D();
    head.name = "head";
    root.add(upper, thigh, head);

    const rigMap = buildRigRetargetMap(root, remap);
    applyRetargetedPose(
      rigMap.bones.get("leftArm")!,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, -0.35, 0),
    );
    applyRetargetedPose(
      rigMap.bones.get("leftForeArm")!,
      new THREE.Vector3(1, -0.35, 0),
      new THREE.Vector3(1.4, -0.8, 0),
    );
    applyRetargetedPose(
      rigMap.bones.get("leftUpLeg")!,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.15, -1, 0),
    );
    applyRetargetedPose(
      rigMap.bones.get("leftLeg")!,
      new THREE.Vector3(0.15, -1, 0),
      new THREE.Vector3(0.35, -1.8, 0),
    );

    const missingChild = rigMap.bones.get("head")!;
    expect(missingChild.restDir.length()).toBeCloseTo(1);
    rigMap.bones.forEach(({ bone }) => {
      expect(Number.isFinite(bone.quaternion.x)).toBe(true);
      expect(Number.isFinite(bone.quaternion.w)).toBe(true);
    });
  });

  it("scores pose quality and selects the best candidate", () => {
    const good = makeGoodLandmarks();
    const poor = makeGoodLandmarks().map((point, index) => ({
      ...point,
      x: index % 2 === 0 ? -0.4 : 1.4,
      visibility: index < 20 ? 0.1 : 0.25,
    }));

    const goodScore = scorePoseLandmarks(good);
    const poorScore = scorePoseLandmarks(poor);
    const best = selectBestPoseCandidate([
      { label: "poor", worldLandmarks: poor, screenLandmarks: poor },
      { label: "good", worldLandmarks: good, screenLandmarks: good },
    ]);

    expect(goodScore.label).toBe("Good");
    expect(poorScore.label).toBe("Poor");
    expect(best?.candidate.label).toBe("good");
  });

  it("applies calibration offsets so a captured rest pose returns to rest", () => {
    const { root, remap } = makeRig({
      hips: "hips",
      leftArm: "upper",
      leftForeArm: "fore",
    });
    const hips = new THREE.Object3D();
    hips.name = "hips";
    const upper = new THREE.Object3D();
    upper.name = "upper";
    const fore = new THREE.Object3D();
    fore.name = "fore";
    fore.position.set(0, 1, 0);
    upper.add(fore);
    root.add(hips, upper);
    const rigMap = buildRigRetargetMap(root, remap);
    const pose: PoseBoneData = {
      hips: {
        boneName: "hips",
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI / 5,
        ),
      },
      bones: [
        {
          boneKey: "leftArm",
          boneName: "upper",
          quaternion: new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            Math.PI / 4,
          ),
        },
      ],
    };

    const calibration = buildPoseCalibration(pose, rigMap);
    const calibrated = applyPoseCalibration(pose, calibration);

    expectQuaternionClose(
      calibrated.hips.quaternion,
      rigMap.bones.get("hips")!.restQuat,
    );
    expectQuaternionClose(
      calibrated.bones[0].quaternion,
      rigMap.bones.get("leftArm")!.restQuat,
    );
  });

  it("clamps anatomically extreme rotations toward rest", () => {
    const { root, remap } = makeRig({
      leftForeArm: "fore",
    });
    const fore = new THREE.Object3D();
    fore.name = "fore";
    root.add(fore);
    const rigMap = buildRigRetargetMap(root, remap);
    const pose: PoseBoneData = {
      hips: {
        boneName: "hips",
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
      },
      bones: [
        {
          boneKey: "leftForeArm",
          boneName: "fore",
          quaternion: new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            Math.PI,
          ),
        },
      ],
    };

    const clamped = clampAnatomicalPose(pose, rigMap, { leftForeArm: 45 });
    const angle = rigMap.bones
      .get("leftForeArm")!
      .restQuat.angleTo(clamped.bones[0].quaternion);

    expect(THREE.MathUtils.radToDeg(angle)).toBeLessThanOrEqual(45.0001);
  });
});
