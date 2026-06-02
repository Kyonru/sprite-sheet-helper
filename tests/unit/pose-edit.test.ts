import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { PoseFrame } from "@/utils/pose-to-animation";
import {
  DEFAULT_POSE_CORRECTION,
  applyPoseBoneOverrideToAllFrames,
  applyPoseBoneOverrides,
  applyPoseCorrection,
  buildFinalPoseFrames,
  copyPoseFrameOverrides,
  deletePoseFrame,
  eulerDegToQuaternion,
  mirrorPoseQuaternion,
  pastePoseFrameOverrides,
  resetPoseBoneOverride,
  resetPoseFrameOverrides,
  setPoseBoneOverride,
  trimPoseFramesAfter,
  trimPoseFramesBefore,
  type PoseEditDraft,
} from "@/utils/pose-edit";

const quat = (x = 0, y = 0, z = 0) =>
  eulerDegToQuaternion({ x, y, z });

const frame = (time: number): PoseFrame => ({
  time,
  data: {
    hips: {
      boneName: "mixamorigHips",
      position: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(),
    },
    bones: [
      {
        boneKey: "leftArm",
        boneName: "mixamorigLeftArm",
        quaternion: quat(10, 0, 0),
      },
      {
        boneKey: "rightArm",
        boneName: "mixamorigRightArm",
        quaternion: quat(-20, 0, 0),
      },
      {
        boneKey: "leftLeg",
        boneName: "mixamorigLeftLeg",
        quaternion: quat(0, 15, 0),
      },
      {
        boneKey: "rightLeg",
        boneName: "mixamorigRightLeg",
        quaternion: quat(0, -30, 0),
      },
    ],
  },
});

const draft = (): PoseEditDraft => ({
  frames: [frame(1), frame(2), frame(3)],
  correction: { ...DEFAULT_POSE_CORRECTION },
  overrides: {
    0: { leftArm: { x: 5, y: 6, z: 7 } },
    2: { rightLeg: { x: 8, y: 9, z: 10 } },
  },
});

const expectQuaternionClose = (
  actual: THREE.Quaternion,
  expected: THREE.Quaternion,
) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
  expect(actual.w).toBeCloseTo(expected.w);
};

describe("pose edit utilities", () => {
  it("applies global correction to hips", () => {
    const corrected = applyPoseCorrection(frame(0).data, {
      rotX: 0,
      rotY: 90,
      rotZ: 0,
      mirror: false,
    });

    expectQuaternionClose(corrected.hips.quaternion, quat(0, 90, 0));
  });

  it("applies global movement to hips", () => {
    const corrected = applyPoseCorrection(frame(0).data, {
      ...DEFAULT_POSE_CORRECTION,
      moveX: 1,
      moveY: -2,
      moveZ: 3,
    });

    expect(corrected.hips.position.toArray()).toEqual([1, -2, 3]);
  });

  it("mirrors paired limb quaternions", () => {
    const source = frame(0).data;
    const corrected = applyPoseCorrection(source, {
      ...DEFAULT_POSE_CORRECTION,
      mirror: true,
    });
    const leftArm = corrected.bones.find((bone) => bone.boneKey === "leftArm");
    const rightArm = corrected.bones.find((bone) => bone.boneKey === "rightArm");

    expectQuaternionClose(
      leftArm!.quaternion,
      mirrorPoseQuaternion(source.bones[1].quaternion),
    );
    expectQuaternionClose(
      rightArm!.quaternion,
      mirrorPoseQuaternion(source.bones[0].quaternion),
    );
  });

  it("applies per-bone overrides", () => {
    const edited = applyPoseBoneOverrides(frame(0).data, {
      leftArm: { x: 0, y: 45, z: 0 },
    });
    const leftArm = edited.bones.find((bone) => bone.boneKey === "leftArm");

    expectQuaternionClose(leftArm!.quaternion, quat(0, 45, 0));
  });

  it("applies per-bone position overrides", () => {
    const edited = applyPoseBoneOverrides(frame(0).data, {
      leftArm: { x: 0, y: 45, z: 0, position: { x: 1, y: 2, z: 3 } },
    });
    const leftArm = edited.bones.find((bone) => bone.boneKey === "leftArm");

    expectQuaternionClose(leftArm!.quaternion, quat(0, 45, 0));
    expect(leftArm!.position?.toArray()).toEqual([1, 2, 3]);
  });

  it("deletes frames and shifts override indexes", () => {
    const next = deletePoseFrame(draft(), 1);

    expect(next.frames.map((item) => item.time)).toEqual([0, 2]);
    expect(next.overrides).toEqual({
      0: { leftArm: { x: 5, y: 6, z: 7 } },
      1: { rightLeg: { x: 8, y: 9, z: 10 } },
    });
  });

  it("trims frames before and after the current index", () => {
    const trimmedBefore = trimPoseFramesBefore(draft(), 1);
    const trimmedAfter = trimPoseFramesAfter(draft(), 1);

    expect(trimmedBefore.frames.map((item) => item.time)).toEqual([0, 1]);
    expect(trimmedBefore.overrides).toEqual({
      1: { rightLeg: { x: 8, y: 9, z: 10 } },
    });
    expect(trimmedAfter.frames.map((item) => item.time)).toEqual([0, 1]);
    expect(trimmedAfter.overrides).toEqual({
      0: { leftArm: { x: 5, y: 6, z: 7 } },
    });
  });

  it("sets, resets, copies, pastes, and applies overrides", () => {
    const withBone = setPoseBoneOverride({}, 0, "leftArm", {
      x: 1,
      y: 2,
      z: 3,
    });
    const copied = copyPoseFrameOverrides(withBone, 0);
    const pasted = pastePoseFrameOverrides(withBone, 2, copied);
    const allFrames = applyPoseBoneOverrideToAllFrames(
      pasted,
      draft().frames,
      0,
      "leftArm",
    );
    const withoutBone = resetPoseBoneOverride(allFrames, 1, "leftArm");
    const withoutFrame = resetPoseFrameOverrides(withoutBone, 2);

    expect(allFrames[0].leftArm).toEqual({ x: 1, y: 2, z: 3 });
    expect(allFrames[1].leftArm).toEqual({ x: 1, y: 2, z: 3 });
    expect(allFrames[2].leftArm).toEqual({ x: 1, y: 2, z: 3 });
    expect(withoutBone[1].leftArm).toBeUndefined();
    expect(withoutFrame[2]).toEqual({});
  });

  it("bakes correction and overrides into final frames", () => {
    const next = buildFinalPoseFrames({
      frames: [frame(0)],
      correction: { rotX: 0, rotY: 90, rotZ: 0, mirror: false },
      overrides: { 0: { leftArm: { x: 0, y: 30, z: 0 } } },
    });
    const leftArm = next[0].data.bones.find((bone) => bone.boneKey === "leftArm");

    expectQuaternionClose(next[0].data.hips.quaternion, quat(0, 90, 0));
    expectQuaternionClose(leftArm!.quaternion, quat(0, 30, 0));
  });
});
