import * as THREE from "three";
import type { BoneRemap } from "./bone-remap";
import {
  buildRigRetargetMap,
  type RigRetargetBone,
  type RigRetargetMap,
} from "./pose-retargeting";
import {
  quaternionToEulerDeg,
  vectorToPositionOverride,
  type PoseFrameOverrides,
} from "./pose-edit";

export type IkEffectorKey =
  | "leftElbow"
  | "leftHand"
  | "rightElbow"
  | "rightHand"
  | "leftFoot"
  | "rightFoot"
  | "hips"
  | "torso"
  | "head";

export type IkPoleTargetKey =
  | "leftArmPole"
  | "rightArmPole"
  | "leftLegPole"
  | "rightLegPole";

export type IkEditableTargetKey = IkEffectorKey | IkPoleTargetKey;

export interface IkTarget {
  key: IkEffectorKey;
  label: string;
  position: THREE.Vector3;
}

export interface IkPoleTarget {
  key: IkPoleTargetKey;
  effectorKey: IkEffectorKey;
  label: string;
  position: THREE.Vector3;
}

export interface IkChain {
  key: IkEffectorKey;
  label: string;
  boneKeys: (keyof BoneRemap)[];
  bones: RigRetargetBone[];
  missing: (keyof BoneRemap)[];
  available: boolean;
  endChild?: THREE.Object3D;
  virtualEndLocal?: THREE.Vector3;
  poleKey?: IkPoleTargetKey;
  poleRootKey?: keyof BoneRemap;
  poleJointKey?: keyof BoneRemap;
}

export interface IkRig {
  root: THREE.Object3D;
  rigMap: RigRetargetMap;
  chains: Map<IkEffectorKey, IkChain>;
}

export interface IkSolveOptions {
  iterations?: number;
  tolerance?: number;
  poleTargets?: IkPoleTarget[];
}

export interface IkSolveResult {
  affectedBoneKeys: (keyof BoneRemap)[];
  targetDistances: Partial<Record<IkEffectorKey, number>>;
  clampedTargets: Partial<Record<IkEffectorKey, THREE.Vector3>>;
  reached: boolean;
  warnings: string[];
}

export interface IkAvailability {
  available: IkEffectorKey[];
  missing: Partial<Record<IkEffectorKey, (keyof BoneRemap)[]>>;
}

export interface IkDebugVector {
  x: number;
  y: number;
  z: number;
  finite: boolean;
}

export interface IkDebugQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  finite: boolean;
}

export interface IkDebugSnapshot {
  kind: "pose-studio-ik-debug";
  version: 1;
  capturedAt: string;
  selectedTargetKey: IkEditableTargetKey | null;
  selectedEffectorKey: IkEffectorKey | null;
  draggingTargetKey: IkEditableTargetKey | null;
  finite: boolean;
  warnings: string[];
  root: {
    name: string;
    position: IkDebugVector;
    scale: IkDebugVector;
    worldPosition: IkDebugVector;
    bounds: {
      min: IkDebugVector;
      max: IkDebugVector;
      center: IkDebugVector;
      size: IkDebugVector;
      radius: number;
      finite: boolean;
    };
  };
  chains: Record<
    IkEffectorKey,
    {
      available: boolean;
      missing: string[];
      reach: number;
      anchorWorld: IkDebugVector | null;
      endWorld: IkDebugVector | null;
      maxTargetDistance: number;
      bones: {
        key: keyof BoneRemap;
        name: string;
        parentName: string | null;
        childName: string | null;
        localPosition: IkDebugVector;
        worldPosition: IkDebugVector;
        restPosition: IkDebugVector;
        localQuaternion: IkDebugQuaternion;
        worldQuaternion: IkDebugQuaternion;
        restQuaternion: IkDebugQuaternion;
        restDir: IkDebugVector;
      }[];
    }
  >;
  targets: Partial<
    Record<
      IkEditableTargetKey,
      {
        position: IkDebugVector;
        effectorKey: IkEffectorKey;
        distanceToEnd: number | null;
        distanceToAnchor: number | null;
        clampedPosition: IkDebugVector | null;
        wasClamped: boolean;
      }
    >
  >;
  lastSolveResult: {
    affectedBoneKeys: string[];
    targetDistances: Partial<Record<IkEffectorKey, number>>;
    clampedTargets: Partial<Record<IkEffectorKey, IkDebugVector>>;
    reached: boolean;
    warnings: string[];
  } | null;
}

type IkChainDefinition = {
  key: IkEffectorKey;
  label: string;
  boneKeys: (keyof BoneRemap)[];
  poleKey?: IkPoleTargetKey;
  poleRootKey?: keyof BoneRemap;
  poleJointKey?: keyof BoneRemap;
  endpointMode?: "auto" | "mappedChild" | "bone";
  endpointNamePatterns?: RegExp[];
  virtualEndScale?: number;
};

const IK_CHAIN_DEFINITIONS: IkChainDefinition[] = [
  {
    key: "leftElbow",
    label: "L Elbow",
    boneKeys: ["leftShoulder", "leftArm"],
    endpointMode: "mappedChild",
    virtualEndScale: 0.85,
  },
  {
    key: "leftHand",
    label: "L Hand",
    boneKeys: ["leftShoulder", "leftArm", "leftForeArm"],
    poleKey: "leftArmPole",
    poleRootKey: "leftArm",
    poleJointKey: "leftForeArm",
    endpointNamePatterns: [
      /left.*hand/i,
      /hand.*left/i,
      /\bl.*hand/i,
      /left.*wrist/i,
      /wrist.*left/i,
    ],
    virtualEndScale: 0.9,
  },
  {
    key: "rightElbow",
    label: "R Elbow",
    boneKeys: ["rightShoulder", "rightArm"],
    endpointMode: "mappedChild",
    virtualEndScale: 0.85,
  },
  {
    key: "rightHand",
    label: "R Hand",
    boneKeys: ["rightShoulder", "rightArm", "rightForeArm"],
    poleKey: "rightArmPole",
    poleRootKey: "rightArm",
    poleJointKey: "rightForeArm",
    endpointNamePatterns: [
      /right.*hand/i,
      /hand.*right/i,
      /\br.*hand/i,
      /right.*wrist/i,
      /wrist.*right/i,
    ],
    virtualEndScale: 0.9,
  },
  {
    key: "leftFoot",
    label: "L Foot",
    boneKeys: ["leftUpLeg", "leftLeg"],
    poleKey: "leftLegPole",
    poleRootKey: "leftUpLeg",
    poleJointKey: "leftLeg",
    endpointMode: "mappedChild",
    virtualEndScale: 0.85,
  },
  {
    key: "rightFoot",
    label: "R Foot",
    boneKeys: ["rightUpLeg", "rightLeg"],
    poleKey: "rightLegPole",
    poleRootKey: "rightUpLeg",
    poleJointKey: "rightLeg",
    endpointMode: "mappedChild",
    virtualEndScale: 0.85,
  },
  {
    key: "hips",
    label: "Hips",
    boneKeys: ["hips"],
  },
  {
    key: "torso",
    label: "Torso",
    boneKeys: ["hips", "spine", "spine1"],
    endpointMode: "mappedChild",
    virtualEndScale: 0.7,
  },
  {
    key: "head",
    label: "Head",
    boneKeys: ["spine", "spine1", "spine2", "neck", "head"],
    endpointNamePatterns: [/head.*top/i, /head.*end/i],
    virtualEndScale: 0.35,
  },
];

export const IK_POLE_TARGET_EFFECTORS: Record<IkPoleTargetKey, IkEffectorKey> = {
  leftArmPole: "leftHand",
  rightArmPole: "rightHand",
  leftLegPole: "leftFoot",
  rightLegPole: "rightFoot",
};

const tempVecA = new THREE.Vector3();
const tempQuatA = new THREE.Quaternion();
const tempQuatB = new THREE.Quaternion();

function roundNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(5)) : value;
}

function isFiniteVector(vector: THREE.Vector3) {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

function isFiniteQuaternion(quaternion: THREE.Quaternion) {
  return (
    Number.isFinite(quaternion.x) &&
    Number.isFinite(quaternion.y) &&
    Number.isFinite(quaternion.z) &&
    Number.isFinite(quaternion.w)
  );
}

function debugVector(vector: THREE.Vector3): IkDebugVector {
  return {
    x: roundNumber(vector.x),
    y: roundNumber(vector.y),
    z: roundNumber(vector.z),
    finite: isFiniteVector(vector),
  };
}

function debugQuaternion(quaternion: THREE.Quaternion): IkDebugQuaternion {
  return {
    x: roundNumber(quaternion.x),
    y: roundNumber(quaternion.y),
    z: roundNumber(quaternion.z),
    w: roundNumber(quaternion.w),
    finite: isFiniteQuaternion(quaternion),
  };
}

function roundDistance(value: number | null | undefined) {
  return value === null || value === undefined ? null : roundNumber(value);
}

function ikTargetToEffectorKey(
  key: IkEditableTargetKey,
): IkEffectorKey {
  return key in IK_POLE_TARGET_EFFECTORS
    ? IK_POLE_TARGET_EFFECTORS[key as IkPoleTargetKey]
    : (key as IkEffectorKey);
}

function getWorldPosition(object: THREE.Object3D) {
  return object.getWorldPosition(new THREE.Vector3());
}

function getRestWorldPosition(boneData: RigRetargetBone) {
  const position = boneData.restPosition.clone();
  return boneData.bone.parent
    ? boneData.bone.parent.localToWorld(position)
    : position;
}

function getBoneEntry(
  rigMap: RigRetargetMap,
  key: keyof BoneRemap | undefined,
) {
  return key ? rigMap.bones.get(key) : undefined;
}

function computeVirtualEndLocal(
  bones: RigRetargetBone[],
  scale = 0.75,
) {
  const end = bones.at(-1);
  const previous = bones.at(-2);
  if (!end || !previous) return undefined;

  const endWorld = getWorldPosition(end.bone);
  const previousWorld = getWorldPosition(previous.bone);
  const direction = endWorld.clone().sub(previousWorld);
  let length = direction.length();
  if (length < 1e-5) {
    direction.set(0, 1, 0);
    length = 0.25;
  }

  const virtualWorld = endWorld
    .clone()
    .add(direction.normalize().multiplyScalar(length * scale));
  return end.bone.worldToLocal(virtualWorld);
}

function getDescendantsBreadthFirst(object: THREE.Object3D) {
  const result: THREE.Object3D[] = [];
  const queue = [...object.children];
  while (queue.length > 0) {
    const child = queue.shift()!;
    result.push(child);
    queue.push(...child.children);
  }
  return result;
}

function objectDistanceSq(a: THREE.Object3D, b: THREE.Object3D) {
  return getWorldPosition(a).distanceToSquared(getWorldPosition(b));
}

function findEndpointObject(
  endBone: RigRetargetBone | undefined,
  definition: IkChainDefinition,
) {
  if (!endBone) return undefined;
  const mappedChild =
    endBone.child && objectDistanceSq(endBone.bone, endBone.child) > 1e-8
      ? endBone.child
      : undefined;
  if (definition.endpointMode === "bone") return undefined;
  if (definition.endpointMode === "mappedChild") return mappedChild;

  const descendants = getDescendantsBreadthFirst(endBone.bone).filter(
    (candidate) => objectDistanceSq(endBone.bone, candidate) > 1e-8,
  );
  const namedMatch = descendants.find((candidate) =>
    definition.endpointNamePatterns?.some((pattern) =>
      pattern.test(candidate.name),
    ),
  );
  if (namedMatch) return namedMatch;

  return descendants.reduce<THREE.Object3D | undefined>((best, candidate) => {
    if (!best) return candidate;
    return objectDistanceSq(endBone.bone, candidate) >
      objectDistanceSq(endBone.bone, best)
      ? candidate
      : best;
  }, mappedChild);
}

export function getIkChainEndWorld(chain: IkChain) {
  if (chain.endChild) return getWorldPosition(chain.endChild);
  const end = chain.bones.at(-1);
  if (!end) return new THREE.Vector3();
  if (chain.virtualEndLocal) {
    return end.bone.localToWorld(chain.virtualEndLocal.clone());
  }
  return getWorldPosition(end.bone);
}

function getIkChainReach(chain: IkChain) {
  if (chain.key === "hips" || chain.bones.length === 0) return 0;

  let reach = 0;
  for (let index = 0; index < chain.bones.length - 1; index += 1) {
    reach += getWorldPosition(chain.bones[index].bone).distanceTo(
      getWorldPosition(chain.bones[index + 1].bone),
    );
  }

  reach += getWorldPosition(chain.bones.at(-1)!.bone).distanceTo(
    getIkChainEndWorld(chain),
  );
  return reach;
}

function getRigWorldRadius(rig: IkRig) {
  const box = new THREE.Box3().setFromObject(rig.root);
  const size = box.getSize(new THREE.Vector3());
  const radius = size.length() * 0.5;
  return Number.isFinite(radius) && radius > 1e-5 ? radius : 1;
}

function clampTargetToChain(
  rig: IkRig,
  chain: IkChain,
  targetWorld: THREE.Vector3,
) {
  if (chain.bones.length === 0) return targetWorld.clone();

  const anchor = getChainAnchorWorld(chain);
  if (!anchor) return targetWorld.clone();
  if (!isFiniteVector(targetWorld)) {
    return chain.key === "hips" ? anchor.clone() : getIkChainEndWorld(chain);
  }
  if (!isFiniteVector(anchor)) return targetWorld.clone();
  const maxDistance = getChainMaxTargetDistance(rig, chain);
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
    return targetWorld.clone();
  }
  const offset = targetWorld.clone().sub(anchor);
  if (!isFiniteVector(offset)) return anchor.clone();
  if (offset.lengthSq() <= maxDistance * maxDistance) {
    return targetWorld.clone();
  }
  return anchor.add(offset.setLength(maxDistance));
}

function getChainAnchorWorld(chain: IkChain) {
  const first = chain.bones[0];
  if (!first) return null;
  return chain.key === "hips"
    ? getRestWorldPosition(first)
    : getWorldPosition(first.bone);
}

function getChainMaxTargetDistance(rig: IkRig, chain: IkChain) {
  if (chain.bones.length === 0) return 0;
  return chain.key === "hips"
    ? Math.max(0.35, getRigWorldRadius(rig) * 0.45)
    : Math.max(0.05, getIkChainReach(chain) * 1.08);
}

export function buildIkRigFromRemap(
  object: THREE.Object3D,
  remap: BoneRemap,
): IkRig {
  object.updateMatrixWorld(true);
  const rigMap = buildRigRetargetMap(object, remap);
  const chains = new Map<IkEffectorKey, IkChain>();

  for (const definition of IK_CHAIN_DEFINITIONS) {
    const bones = definition.boneKeys
      .map((key) => rigMap.bones.get(key))
      .filter((bone): bone is RigRetargetBone => Boolean(bone));
    const missing = definition.boneKeys.filter((key) => !rigMap.bones.has(key));
    const available = missing.length === 0 && bones.length > 0;
    const end = bones.at(-1);
    const endpointObject = findEndpointObject(end, definition);

    chains.set(definition.key, {
      key: definition.key,
      label: definition.label,
      boneKeys: definition.boneKeys,
      bones,
      missing,
      available,
      endChild: endpointObject,
      virtualEndLocal:
        available && definition.endpointMode !== "bone" && !endpointObject
          ? computeVirtualEndLocal(bones, definition.virtualEndScale)
          : undefined,
      poleKey: definition.poleKey,
      poleRootKey: definition.poleRootKey,
      poleJointKey: definition.poleJointKey,
    });
  }

  return { root: object, rigMap, chains };
}

export function getIkAvailability(rig: IkRig): IkAvailability {
  const available: IkEffectorKey[] = [];
  const missing: Partial<Record<IkEffectorKey, (keyof BoneRemap)[]>> = {};

  rig.chains.forEach((chain, key) => {
    if (chain.available) {
      available.push(key);
    } else {
      missing[key] = chain.missing;
    }
  });

  return { available, missing };
}

export function createIkTargetsFromPose(rig: IkRig): IkTarget[] {
  const targets: IkTarget[] = [];
  rig.chains.forEach((chain) => {
    if (!chain.available) return;
    const position =
      chain.key === "hips"
        ? getWorldPosition(chain.bones[0].bone)
        : getIkChainEndWorld(chain);
    targets.push({
      key: chain.key,
      label: chain.label,
      position,
    });
  });
  return targets;
}

export function createIkPoleTargetsFromPose(rig: IkRig): IkPoleTarget[] {
  const targets: IkPoleTarget[] = [];

  rig.chains.forEach((chain) => {
    if (!chain.available || !chain.poleKey) return;
    const root = getBoneEntry(rig.rigMap, chain.poleRootKey);
    const joint = getBoneEntry(rig.rigMap, chain.poleJointKey);
    if (!root || !joint) return;

    const rootWorld = getWorldPosition(root.bone);
    const jointWorld = getWorldPosition(joint.bone);
    const endWorld = getIkChainEndWorld(chain);
    const axis = endWorld.clone().sub(rootWorld);
    const bend = jointWorld.clone().sub(rootWorld);
    if (axis.lengthSq() < 1e-8 || bend.lengthSq() < 1e-8) return;

    const axisLength = axis.length();
    const axisNormal = axis.normalize();
    const poleDirection = bend
      .clone()
      .sub(axisNormal.clone().multiplyScalar(bend.dot(axisNormal)));
    if (poleDirection.lengthSq() < 1e-8) {
      poleDirection.crossVectors(axisNormal, new THREE.Vector3(0, 1, 0));
      if (poleDirection.lengthSq() < 1e-8) {
        poleDirection.crossVectors(axisNormal, new THREE.Vector3(1, 0, 0));
      }
    }

    targets.push({
      key: chain.poleKey,
      effectorKey: chain.key,
      label: `${chain.label} pole`,
      position: jointWorld
        .clone()
        .add(poleDirection.normalize().multiplyScalar(axisLength * 0.35)),
    });
  });

  return targets;
}

function applyWorldQuaternion(
  bone: THREE.Object3D,
  worldQuaternion: THREE.Quaternion,
) {
  if (!isFiniteQuaternion(worldQuaternion)) return;
  if (!bone.parent) {
    bone.quaternion.copy(worldQuaternion).normalize();
    bone.updateMatrixWorld(true);
    return;
  }

  const parentWorld = bone.parent.getWorldQuaternion(tempQuatA).clone();
  if (!isFiniteQuaternion(parentWorld)) return;
  bone.quaternion
    .copy(parentWorld.invert().multiply(worldQuaternion))
    .normalize();
  bone.updateMatrixWorld(true);
}

function rotateBoneTowardTarget(
  bone: THREE.Object3D,
  effectorWorld: THREE.Vector3,
  targetWorld: THREE.Vector3,
) {
  const boneWorld = bone.getWorldPosition(tempVecA);
  const toEffector = effectorWorld.clone().sub(boneWorld);
  const toTarget = targetWorld.clone().sub(boneWorld);
  if (
    !isFiniteVector(boneWorld) ||
    !isFiniteVector(toEffector) ||
    !isFiniteVector(toTarget) ||
    toEffector.lengthSq() < 1e-8 ||
    toTarget.lengthSq() < 1e-8
  ) {
    return false;
  }

  const deltaWorld = new THREE.Quaternion().setFromUnitVectors(
    toEffector.normalize(),
    toTarget.normalize(),
  );
  if (!isFiniteQuaternion(deltaWorld)) return false;
  const currentWorld = bone.getWorldQuaternion(tempQuatB).clone();
  if (!isFiniteQuaternion(currentWorld)) return false;
  applyWorldQuaternion(bone, deltaWorld.multiply(currentWorld));
  return true;
}

function moveHipsToTarget(chain: IkChain, targetWorld: THREE.Vector3) {
  const hips = chain.bones[0]?.bone;
  if (!hips || !isFiniteVector(targetWorld)) return false;
  if (hips.parent) {
    hips.position.copy(hips.parent.worldToLocal(targetWorld.clone()));
  } else {
    hips.position.copy(targetWorld);
  }
  hips.updateMatrixWorld(true);
  return true;
}

function applyPoleHint(chain: IkChain, poleWorld: THREE.Vector3) {
  if (!isFiniteVector(poleWorld)) return false;
  const root = chain.bones.find((bone) => bone.key === chain.poleRootKey);
  const joint = chain.bones.find((bone) => bone.key === chain.poleJointKey);
  if (!root || !joint) return false;

  const rootWorld = getWorldPosition(root.bone);
  const jointWorld = getWorldPosition(joint.bone);
  const endWorld = getIkChainEndWorld(chain);
  const axis = endWorld.clone().sub(rootWorld);
  if (
    !isFiniteVector(rootWorld) ||
    !isFiniteVector(jointWorld) ||
    !isFiniteVector(endWorld) ||
    !isFiniteVector(axis) ||
    axis.lengthSq() < 1e-8
  ) {
    return false;
  }

  const axisNormal = axis.normalize();
  const currentFromRoot = jointWorld.clone().sub(rootWorld);
  const desiredFromRoot = poleWorld.clone().sub(rootWorld);
  const currentPlane = currentFromRoot
    .clone()
    .sub(axisNormal.clone().multiplyScalar(currentFromRoot.dot(axisNormal)));
  const desiredPlane = poleWorld
    .clone()
    .sub(rootWorld)
    .sub(
      axisNormal
        .clone()
        .multiplyScalar(desiredFromRoot.dot(axisNormal)),
    );
  if (
    !isFiniteVector(currentPlane) ||
    !isFiniteVector(desiredPlane) ||
    currentPlane.lengthSq() < 1e-8 ||
    desiredPlane.lengthSq() < 1e-8
  ) {
    return false;
  }

  const deltaWorld = new THREE.Quaternion().setFromUnitVectors(
    currentPlane.normalize(),
    desiredPlane.normalize(),
  );
  if (!isFiniteQuaternion(deltaWorld)) return false;
  const currentWorld = root.bone.getWorldQuaternion(new THREE.Quaternion());
  if (!isFiniteQuaternion(currentWorld)) return false;
  applyWorldQuaternion(root.bone, deltaWorld.multiply(currentWorld));
  return true;
}

function solveChainToTarget(
  rig: IkRig,
  chain: IkChain,
  targetWorld: THREE.Vector3,
  poleWorld: THREE.Vector3 | undefined,
  iterations: number,
  tolerance: number,
) {
  if (chain.key === "hips") {
    moveHipsToTarget(chain, targetWorld);
    rig.root.updateMatrixWorld(true);
    return getWorldPosition(chain.bones[0].bone).distanceTo(targetWorld);
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    rig.root.updateMatrixWorld(true);
    for (let index = chain.bones.length - 1; index >= 0; index -= 1) {
      const effectorWorld = getIkChainEndWorld(chain);
      if (effectorWorld.distanceToSquared(targetWorld) <= tolerance * tolerance) {
        return Math.sqrt(effectorWorld.distanceToSquared(targetWorld));
      }
      rotateBoneTowardTarget(chain.bones[index].bone, effectorWorld, targetWorld);
      rig.root.updateMatrixWorld(true);
    }
    if (poleWorld) {
      applyPoleHint(chain, poleWorld);
      rig.root.updateMatrixWorld(true);
    }
  }

  return getIkChainEndWorld(chain).distanceTo(targetWorld);
}

function captureChainState(chain: IkChain) {
  return chain.bones.map((boneData) => ({
    bone: boneData.bone,
    position: boneData.bone.position.clone(),
    quaternion: boneData.bone.quaternion.clone(),
  }));
}

function restoreChainState(
  states: ReturnType<typeof captureChainState>,
  root: THREE.Object3D,
) {
  states.forEach((state) => {
    state.bone.position.copy(state.position);
    state.bone.quaternion.copy(state.quaternion);
    state.bone.updateMatrixWorld(true);
  });
  root.updateMatrixWorld(true);
}

function repairNonFiniteChain(chain: IkChain) {
  let repaired = false;
  chain.bones.forEach((boneData) => {
    if (!isFiniteVector(boneData.bone.position)) {
      boneData.bone.position.copy(boneData.restPosition);
      repaired = true;
    }
    if (!isFiniteQuaternion(boneData.bone.quaternion)) {
      boneData.bone.quaternion.copy(boneData.restQuat);
      repaired = true;
    }
    if (repaired) boneData.bone.updateMatrixWorld(true);
  });
  return repaired;
}

export function solveFullBodyIk(
  rig: IkRig,
  targets: IkTarget[],
  options: IkSolveOptions = {},
): IkSolveResult {
  const iterations = options.iterations ?? 10;
  const tolerance = options.tolerance ?? 0.015;
  const affected = new Set<keyof BoneRemap>();
  const targetDistances: Partial<Record<IkEffectorKey, number>> = {};
  const clampedTargets: Partial<Record<IkEffectorKey, THREE.Vector3>> = {};
  const warnings: string[] = [];
  const poleTargets = new Map(
    (options.poleTargets ?? []).map((target) => [target.effectorKey, target]),
  );

  for (const target of targets) {
    const chain = rig.chains.get(target.key);
    if (!chain || !chain.available) {
      warnings.push(`${target.key} IK chain is not available.`);
      continue;
    }
    if (!isFiniteVector(target.position)) {
      warnings.push(`${target.key} target has non-finite coordinates.`);
      continue;
    }
    if (repairNonFiniteChain(chain)) {
      rig.root.updateMatrixWorld(true);
      warnings.push(`${target.key} IK chain contained non-finite transforms and was reset to rest.`);
    }

    const poleTarget = poleTargets.get(target.key);
    const clampedTarget = clampTargetToChain(rig, chain, target.position);
    if (!isFiniteVector(clampedTarget)) {
      warnings.push(`${target.key} target clamp produced non-finite coordinates.`);
      continue;
    }
    if (clampedTarget.distanceToSquared(target.position) > 1e-6) {
      clampedTargets[target.key] = clampedTarget.clone();
      warnings.push(`${target.key} target was clamped to the rig reach.`);
    }
    const previousState = captureChainState(chain);
    const distance = solveChainToTarget(
      rig,
      chain,
      clampedTarget,
      poleTarget?.position,
      iterations,
      tolerance,
    );
    if (!Number.isFinite(distance)) {
      restoreChainState(previousState, rig.root);
      warnings.push(`${target.key} solve produced a non-finite distance.`);
      continue;
    }
    const solvedFinite = chain.bones.every((boneData) =>
      isFiniteQuaternion(boneData.bone.quaternion),
    );
    if (!solvedFinite) {
      restoreChainState(previousState, rig.root);
      warnings.push(`${target.key} solve produced non-finite bone rotations.`);
      continue;
    }
    targetDistances[target.key] = distance;
    chain.bones.forEach((bone) => affected.add(bone.key));
  }

  return {
    affectedBoneKeys: [...affected],
    targetDistances,
    clampedTargets,
    reached: Object.values(targetDistances).every(
      (distance) => distance <= tolerance * 4,
    ),
    warnings,
  };
}

export function bakeIkResultToOverrides(
  rig: IkRig,
  affectedBoneKeys: readonly (keyof BoneRemap)[],
  baseOverrides: PoseFrameOverrides = {},
): PoseFrameOverrides {
  const next: PoseFrameOverrides = { ...baseOverrides };

  for (const key of affectedBoneKeys) {
    const boneData = rig.rigMap.bones.get(key);
    if (!boneData) continue;
    if (!isFiniteQuaternion(boneData.bone.quaternion)) continue;
    const override = quaternionToEulerDeg(boneData.bone.quaternion);
    if (
      !Number.isFinite(override.x) ||
      !Number.isFinite(override.y) ||
      !Number.isFinite(override.z)
    ) {
      continue;
    }
    if (key === "hips") {
      if (isFiniteVector(boneData.bone.position)) {
        override.position = vectorToPositionOverride(boneData.bone.position);
      }
    } else if (baseOverrides[key]?.position) {
      override.position = baseOverrides[key].position;
    }
    next[key] = override;
  }

  return next;
}

export function createIkDebugSnapshot(
  rig: IkRig,
  options: {
    selectedTargetKey?: IkEditableTargetKey | null;
    selectedEffectorKey?: IkEffectorKey | null;
    draggingTargetKey?: IkEditableTargetKey | null;
    targetPositions?: ReadonlyMap<IkEditableTargetKey, THREE.Vector3>;
    lastSolveResult?: IkSolveResult | null;
  } = {},
): IkDebugSnapshot {
  rig.root.updateMatrixWorld(true);
  const warnings: string[] = [];
  const captureVector = (label: string, vector: THREE.Vector3) => {
    const next = debugVector(vector);
    if (!next.finite) warnings.push(`${label} has non-finite vector values.`);
    return next;
  };
  const captureQuaternion = (
    label: string,
    quaternion: THREE.Quaternion,
  ) => {
    const next = debugQuaternion(quaternion);
    if (!next.finite) {
      warnings.push(`${label} has non-finite quaternion values.`);
    }
    return next;
  };
  const box = new THREE.Box3().setFromObject(rig.root);
  const boundsMin = box.min.clone();
  const boundsMax = box.max.clone();
  const boundsCenter = box.getCenter(new THREE.Vector3());
  const boundsSize = box.getSize(new THREE.Vector3());
  const radius = getRigWorldRadius(rig);

  const chains = {} as IkDebugSnapshot["chains"];
  rig.chains.forEach((chain, key) => {
    const anchorWorld = getChainAnchorWorld(chain);
    const endWorld = chain.available ? getIkChainEndWorld(chain) : null;
    chains[key] = {
      available: chain.available,
      missing: chain.missing,
      reach: roundNumber(getIkChainReach(chain)),
      anchorWorld: anchorWorld
        ? captureVector(`${key}.anchorWorld`, anchorWorld)
        : null,
      endWorld: endWorld ? captureVector(`${key}.endWorld`, endWorld) : null,
      maxTargetDistance: roundNumber(getChainMaxTargetDistance(rig, chain)),
      bones: chain.bones.map((boneData) => ({
        key: boneData.key,
        name: boneData.boneName,
        parentName: boneData.bone.parent?.name ?? null,
        childName: boneData.childName ?? null,
        localPosition: captureVector(
          `${key}.${boneData.key}.localPosition`,
          boneData.bone.position,
        ),
        worldPosition: captureVector(
          `${key}.${boneData.key}.worldPosition`,
          getWorldPosition(boneData.bone),
        ),
        restPosition: captureVector(
          `${key}.${boneData.key}.restPosition`,
          boneData.restPosition,
        ),
        localQuaternion: captureQuaternion(
          `${key}.${boneData.key}.localQuaternion`,
          boneData.bone.quaternion,
        ),
        worldQuaternion: captureQuaternion(
          `${key}.${boneData.key}.worldQuaternion`,
          boneData.bone.getWorldQuaternion(new THREE.Quaternion()),
        ),
        restQuaternion: captureQuaternion(
          `${key}.${boneData.key}.restQuaternion`,
          boneData.restQuat,
        ),
        restDir: captureVector(`${key}.${boneData.key}.restDir`, boneData.restDir),
      })),
    };
  });

  const targets: IkDebugSnapshot["targets"] = {};
  options.targetPositions?.forEach((position, targetKey) => {
    const effectorKey = ikTargetToEffectorKey(targetKey);
    const chain = rig.chains.get(effectorKey);
    const endWorld = chain?.available ? getIkChainEndWorld(chain) : null;
    const anchorWorld = chain ? getChainAnchorWorld(chain) : null;
    const clamped =
      chain?.available && targetKey === effectorKey
        ? clampTargetToChain(rig, chain, position)
        : null;
    targets[targetKey] = {
      position: captureVector(`${targetKey}.position`, position),
      effectorKey,
      distanceToEnd:
        endWorld && isFiniteVector(position)
          ? roundDistance(position.distanceTo(endWorld))
          : null,
      distanceToAnchor:
        anchorWorld && isFiniteVector(position)
          ? roundDistance(position.distanceTo(anchorWorld))
          : null,
      clampedPosition: clamped
        ? captureVector(`${targetKey}.clampedPosition`, clamped)
        : null,
      wasClamped: clamped
        ? clamped.distanceToSquared(position) > 1e-6
        : false,
    };
  });

  const clampedTargets: Partial<Record<IkEffectorKey, IkDebugVector>> = {};
  if (options.lastSolveResult) {
    Object.entries(options.lastSolveResult.clampedTargets).forEach(
      ([key, vector]) => {
        if (!vector) return;
        clampedTargets[key as IkEffectorKey] = captureVector(
          `lastSolve.${key}.clampedTarget`,
          vector,
        );
      },
    );
  }

  return {
    kind: "pose-studio-ik-debug",
    version: 1,
    capturedAt: new Date().toISOString(),
    selectedTargetKey: options.selectedTargetKey ?? null,
    selectedEffectorKey: options.selectedEffectorKey ?? null,
    draggingTargetKey: options.draggingTargetKey ?? null,
    finite: warnings.length === 0,
    warnings,
    root: {
      name: rig.root.name,
      position: captureVector("root.position", rig.root.position),
      scale: captureVector("root.scale", rig.root.scale),
      worldPosition: captureVector(
        "root.worldPosition",
        getWorldPosition(rig.root),
      ),
      bounds: {
        min: captureVector("root.bounds.min", boundsMin),
        max: captureVector("root.bounds.max", boundsMax),
        center: captureVector("root.bounds.center", boundsCenter),
        size: captureVector("root.bounds.size", boundsSize),
        radius: roundNumber(radius),
        finite:
          isFiniteVector(boundsMin) &&
          isFiniteVector(boundsMax) &&
          isFiniteVector(boundsCenter) &&
          isFiniteVector(boundsSize) &&
          Number.isFinite(radius),
      },
    },
    chains,
    targets,
    lastSolveResult: options.lastSolveResult
      ? {
          affectedBoneKeys: options.lastSolveResult.affectedBoneKeys,
          targetDistances: Object.fromEntries(
            Object.entries(options.lastSolveResult.targetDistances).map(
              ([key, value]) => [key, roundDistance(value)],
            ),
          ),
          clampedTargets,
          reached: options.lastSolveResult.reached,
          warnings: options.lastSolveResult.warnings,
        }
      : null,
  };
}
