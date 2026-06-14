import * as THREE from "three";
import type { ModelDowngradeVariant } from "@/types/model-downgrade";

export type RuntimeClip = {
  action: THREE.AnimationAction;
  clip: THREE.AnimationClip;
};

export type RuntimeModel = {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  clips: RuntimeClip[];
};

const originals = new Map<string, RuntimeModel>();
const downgraded = new Map<string, RuntimeModel>();

export function setOriginalRuntimeModel(uuid: string, runtime: RuntimeModel) {
  originals.set(uuid, runtime);
}

export function setOriginalRuntimeClips(
  uuid: string,
  clips: RuntimeClip[],
  mixer?: THREE.AnimationMixer | null,
) {
  const runtime = originals.get(uuid);
  if (!runtime) return;
  runtime.clips = clips;
  if (mixer !== undefined) {
    runtime.mixer = mixer;
  }
}

export function setDowngradedRuntimeModel(uuid: string, runtime: RuntimeModel) {
  downgraded.set(uuid, runtime);
}

export function getOriginalRuntimeModel(uuid: string) {
  return originals.get(uuid);
}

export function getDowngradedRuntimeModel(uuid: string) {
  return downgraded.get(uuid);
}

export function getRuntimeModel(
  uuid: string,
  variant: ModelDowngradeVariant = "original",
) {
  if (variant === "downgraded") {
    return downgraded.get(uuid) ?? originals.get(uuid);
  }
  return originals.get(uuid);
}

export function clearDowngradedRuntimeModel(uuid: string) {
  downgraded.delete(uuid);
}

export function clearRuntimeModel(uuid: string) {
  originals.delete(uuid);
  downgraded.delete(uuid);
}

export function createRuntimeFromObject(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[],
): RuntimeModel {
  const mixer = clips.length > 0 ? new THREE.AnimationMixer(object) : null;
  return {
    object,
    mixer,
    clips: mixer
      ? clips.map((clip) => ({ clip, action: mixer.clipAction(clip) }))
      : [],
  };
}
