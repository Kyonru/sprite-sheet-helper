import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MIXAMO_DEFAULT_REMAP, type BoneRemap } from "@/utils/bone-remap";
import {
  bakeIkResultToOverrides,
  buildIkRigFromRemap,
  createIkDebugSnapshot,
  createIkPoleTargetsFromPose,
  createIkTargetsFromPose,
  getIkAvailability,
  getIkChainEndWorld,
  solveFullBodyIk,
} from "@/utils/pose-ik";

function makeBone(name: string, position: [number, number, number]) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.set(...position);
  return bone;
}

function makeArmRig(remapPatch: Partial<BoneRemap> = {}) {
  const remap = {
    ...MIXAMO_DEFAULT_REMAP,
    leftShoulder: "shoulder",
    leftArm: "upper",
    leftForeArm: "fore",
    ...remapPatch,
  };
  const root = new THREE.Object3D();
  root.name = "root";
  const shoulder = makeBone("shoulder", [0, 0, 0]);
  const upper = makeBone("upper", [0, 1, 0]);
  const fore = makeBone("fore", [0, 1, 0]);
  const hand = makeBone("hand", [0, 1, 0]);
  shoulder.add(upper);
  upper.add(fore);
  fore.add(hand);
  root.add(shoulder);
  root.updateMatrixWorld(true);
  return { root, remap, hand };
}

function makeFullRig() {
  const remap = {
    ...MIXAMO_DEFAULT_REMAP,
    hips: "hips",
    spine: "spine",
    spine1: "spine1",
    spine2: "spine2",
    neck: "neck",
    head: "head",
    leftShoulder: "leftShoulder",
    leftArm: "leftArm",
    leftForeArm: "leftForeArm",
    rightShoulder: "rightShoulder",
    rightArm: "rightArm",
    rightForeArm: "rightForeArm",
    leftUpLeg: "leftUpLeg",
    leftLeg: "leftLeg",
    leftFoot: "leftFoot",
    rightUpLeg: "rightUpLeg",
    rightLeg: "rightLeg",
    rightFoot: "rightFoot",
  };
  const root = new THREE.Object3D();
  const hips = makeBone("hips", [0, 0, 0]);
  const spine = makeBone("spine", [0, 1, 0]);
  const spine1 = makeBone("spine1", [0, 0.5, 0]);
  const spine2 = makeBone("spine2", [0, 0.5, 0]);
  const neck = makeBone("neck", [0, 0.3, 0]);
  const head = makeBone("head", [0, 0.3, 0]);
  const leftShoulder = makeBone("leftShoulder", [-0.25, 0.2, 0]);
  const leftArm = makeBone("leftArm", [-0.5, 0, 0]);
  const leftForeArm = makeBone("leftForeArm", [-0.5, 0, 0]);
  const leftHand = makeBone("leftHand", [-0.35, 0, 0]);
  const rightShoulder = makeBone("rightShoulder", [0.25, 0.2, 0]);
  const rightArm = makeBone("rightArm", [0.5, 0, 0]);
  const rightForeArm = makeBone("rightForeArm", [0.5, 0, 0]);
  const rightHand = makeBone("rightHand", [0.35, 0, 0]);
  const leftUpLeg = makeBone("leftUpLeg", [-0.2, -0.5, 0]);
  const leftLeg = makeBone("leftLeg", [0, -0.8, 0]);
  const leftFoot = makeBone("leftFoot", [0, -0.8, 0]);
  const leftToe = makeBone("leftToe", [0, -0.1, 0.35]);
  const rightUpLeg = makeBone("rightUpLeg", [0.2, -0.5, 0]);
  const rightLeg = makeBone("rightLeg", [0, -0.8, 0]);
  const rightFoot = makeBone("rightFoot", [0, -0.8, 0]);
  const rightToe = makeBone("rightToe", [0, -0.1, 0.35]);

  root.add(hips);
  hips.add(spine, leftUpLeg, rightUpLeg);
  spine.add(spine1);
  spine1.add(spine2);
  spine2.add(neck, leftShoulder, rightShoulder);
  neck.add(head);
  leftShoulder.add(leftArm);
  leftArm.add(leftForeArm);
  leftForeArm.add(leftHand);
  rightShoulder.add(rightArm);
  rightArm.add(rightForeArm);
  rightForeArm.add(rightHand);
  leftUpLeg.add(leftLeg);
  leftLeg.add(leftFoot);
  leftFoot.add(leftToe);
  rightUpLeg.add(rightLeg);
  rightLeg.add(rightFoot);
  rightFoot.add(rightToe);
  root.updateMatrixWorld(true);
  return { root, remap };
}

describe("pose IK utilities", () => {
  it("builds main effectors and reports missing chains", () => {
    const { root, remap } = makeFullRig();
    const rig = buildIkRigFromRemap(root, remap);
    const status = getIkAvailability(rig);

    expect(status.available).toEqual([
      "leftElbow",
      "leftHand",
      "rightElbow",
      "rightHand",
      "leftFoot",
      "rightFoot",
      "hips",
      "torso",
      "head",
    ]);
    expect(createIkTargetsFromPose(rig)).toHaveLength(9);

    const missingRig = buildIkRigFromRemap(root, {
      ...remap,
      leftForeArm: "missing",
    });
    expect(missingRig.chains.get("leftHand")?.available).toBe(false);
    expect(getIkAvailability(missingRig).missing.leftHand).toContain(
      "leftForeArm",
    );
    expect(missingRig.chains.get("leftElbow")?.available).toBe(true);
  });

  it("solves an arm chain toward a hand target", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const chain = rig.chains.get("leftHand")!;
    const before = getIkChainEndWorld(chain);
    const target = before.clone().add(new THREE.Vector3(1.2, -0.5, 0));

    const result = solveFullBodyIk(
      rig,
      [{ key: "leftHand", label: "L Hand", position: target }],
      { iterations: 18, tolerance: 0.01 },
    );
    const after = getIkChainEndWorld(chain);

    expect(after.distanceTo(target)).toBeLessThan(before.distanceTo(target));
    expect(result.affectedBoneKeys).toEqual([
      "leftShoulder",
      "leftArm",
      "leftForeArm",
    ]);
  });

  it("places hand IK targets on hand descendants instead of the elbow", () => {
    const { root, remap, hand } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const chain = rig.chains.get("leftHand")!;
    const endpoint = getIkChainEndWorld(chain);
    const handWorld = hand.getWorldPosition(new THREE.Vector3());
    const elbowWorld = rig.rigMap.bones
      .get("leftForeArm")!
      .bone.getWorldPosition(new THREE.Vector3());

    expect(endpoint.distanceTo(handWorld)).toBeCloseTo(0);
    expect(endpoint.distanceTo(elbowWorld)).toBeGreaterThan(0.5);
  });

  it("keeps a separate elbow IK target at the elbow", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const endpoint = getIkChainEndWorld(rig.chains.get("leftElbow")!);
    const elbowWorld = rig.rigMap.bones
      .get("leftForeArm")!
      .bone.getWorldPosition(new THREE.Vector3());

    expect(endpoint.distanceTo(elbowWorld)).toBeCloseTo(0);
  });

  it("uses a virtual hand endpoint when a rig has no hand bone", () => {
    const remap = {
      ...MIXAMO_DEFAULT_REMAP,
      leftShoulder: "shoulder",
      leftArm: "upper",
      leftForeArm: "fore",
    };
    const root = new THREE.Object3D();
    const shoulder = makeBone("shoulder", [0, 0, 0]);
    const upper = makeBone("upper", [0, 1, 0]);
    const fore = makeBone("fore", [0, 1, 0]);
    shoulder.add(upper);
    upper.add(fore);
    root.add(shoulder);
    root.updateMatrixWorld(true);

    const rig = buildIkRigFromRemap(root, remap);
    const endpoint = getIkChainEndWorld(rig.chains.get("leftHand")!);
    const elbowWorld = fore.getWorldPosition(new THREE.Vector3());

    expect(endpoint.y).toBeGreaterThan(elbowWorld.y);
    expect(endpoint.distanceTo(elbowWorld)).toBeGreaterThan(0.5);
  });

  it("keeps foot IK targets at the mapped foot instead of toe descendants", () => {
    const { root, remap } = makeFullRig();
    const rig = buildIkRigFromRemap(root, remap);
    const endpoint = getIkChainEndWorld(rig.chains.get("leftFoot")!);
    const footWorld = rig.rigMap.bones
      .get("leftFoot")!
      .bone.getWorldPosition(new THREE.Vector3());
    const toeWorld = rig.rigMap.bones
      .get("leftFoot")!
      .bone.children[0].getWorldPosition(new THREE.Vector3());

    expect(endpoint.distanceTo(footWorld)).toBeCloseTo(0);
    expect(endpoint.distanceTo(toeWorld)).toBeGreaterThan(0.1);
  });

  it("keeps torso and head as separate IK targets", () => {
    const { root, remap } = makeFullRig();
    const rig = buildIkRigFromRemap(root, remap);
    const torso = getIkChainEndWorld(rig.chains.get("torso")!);
    const head = getIkChainEndWorld(rig.chains.get("head")!);

    expect(rig.chains.get("torso")?.available).toBe(true);
    expect(rig.chains.get("head")?.available).toBe(true);
    expect(torso.distanceTo(head)).toBeGreaterThan(0.1);
  });

  it("clamps impossible hand targets to chain reach", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const chain = rig.chains.get("leftHand")!;
    const chainRoot = chain.bones[0].bone.getWorldPosition(new THREE.Vector3());
    const target = chainRoot.clone().add(new THREE.Vector3(100, 0, 0));

    const result = solveFullBodyIk(
      rig,
      [{ key: "leftHand", label: "L Hand", position: target }],
      { iterations: 12, tolerance: 0.01 },
    );
    const after = getIkChainEndWorld(chain);

    expect(result.warnings).toContain(
      "leftHand target was clamped to the rig reach.",
    );
    expect(after.distanceTo(chainRoot)).toBeLessThan(4);
  });

  it("rejects non-finite hand targets without poisoning the chain", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const before = rig.rigMap.bones
      .get("leftArm")!
      .bone.quaternion.clone();

    const result = solveFullBodyIk(
      rig,
      [
        {
          key: "leftHand",
          label: "L Hand",
          position: new THREE.Vector3(Number.NaN, 0, 0),
        },
      ],
    );

    expect(result.affectedBoneKeys).toEqual([]);
    expect(result.warnings).toContain(
      "leftHand target has non-finite coordinates.",
    );
    const after = rig.rigMap.bones.get("leftArm")!.bone.quaternion;
    expect(after.x).toBeCloseTo(before.x);
    rig.rigMap.bones.forEach(({ bone }) => {
      expect(Number.isFinite(bone.quaternion.x)).toBe(true);
      expect(Number.isFinite(bone.quaternion.w)).toBe(true);
    });
  });

  it("keeps pole-hinted solves finite", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const target = createIkTargetsFromPose(rig).find(
      (item) => item.key === "leftHand",
    )!;
    const pole = createIkPoleTargetsFromPose(rig).find(
      (item) => item.key === "leftArmPole",
    )!;

    const result = solveFullBodyIk(
      rig,
      [{ ...target, position: target.position.clone().add(new THREE.Vector3(0.6, 0, 0.4)) }],
      {
        iterations: 12,
        poleTargets: [
          { ...pole, position: pole.position.clone().add(new THREE.Vector3(0, 0, 1)) },
        ],
      },
    );

    expect(result.warnings).toEqual([]);
    rig.rigMap.bones.forEach(({ bone }) => {
      expect(Number.isFinite(bone.quaternion.x)).toBe(true);
      expect(Number.isFinite(bone.quaternion.w)).toBe(true);
    });
  });

  it("bakes affected IK bones into FK overrides including hips position", () => {
    const { root, remap } = makeFullRig();
    const rig = buildIkRigFromRemap(root, remap);
    const hips = rig.rigMap.bones.get("hips")!.bone;
    hips.position.set(1, 2, 3);
    hips.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 4, 0, "YXZ"));
    const arm = rig.rigMap.bones.get("leftArm")!.bone;
    arm.quaternion.setFromEuler(new THREE.Euler(Math.PI / 6, 0, 0, "YXZ"));

    const overrides = bakeIkResultToOverrides(
      rig,
      ["hips", "leftArm"],
      { rightArm: { x: 1, y: 2, z: 3 } },
    );

    expect(overrides.rightArm).toEqual({ x: 1, y: 2, z: 3 });
    expect(overrides.hips.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(overrides.hips.y).toBe(45);
    expect(overrides.leftArm.x).toBe(30);
  });

  it("does not bake non-finite solved rotations into overrides", () => {
    const { root, remap } = makeFullRig();
    const rig = buildIkRigFromRemap(root, remap);
    rig.rigMap.bones.get("leftArm")!.bone.quaternion.set(
      Number.NaN,
      0,
      0,
      1,
    );

    const overrides = bakeIkResultToOverrides(rig, ["leftArm"], {});

    expect(overrides.leftArm).toBeUndefined();
  });

  it("builds a copyable debug snapshot for IK state", () => {
    const { root, remap } = makeArmRig();
    const rig = buildIkRigFromRemap(root, remap);
    const target = createIkTargetsFromPose(rig).find(
      (item) => item.key === "leftHand",
    )!;
    const snapshot = createIkDebugSnapshot(rig, {
      selectedTargetKey: "leftHand",
      selectedEffectorKey: "leftHand",
      targetPositions: new Map([["leftHand", target.position]]),
    });

    expect(snapshot.kind).toBe("pose-studio-ik-debug");
    expect(snapshot.selectedTargetKey).toBe("leftHand");
    expect(snapshot.chains.leftHand.available).toBe(true);
    expect(snapshot.targets.leftHand?.position.finite).toBe(true);
    expect(JSON.stringify(snapshot)).toContain("leftHand");
  });
});
