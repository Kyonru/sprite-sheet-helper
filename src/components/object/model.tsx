import { EventType, PubSub } from "@/lib/events";
import { useModel, useModelsStore } from "@/store/next/models";
import { useAuthoredModelsStore } from "@/store/next/authored-models";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";
import { useRefsStore } from "@/store/next/refs";
import type { ModelComponent as ModelComponentType } from "@/types/ecs";
import {
  buildPlaybackClip,
  getAnimationClipFps,
} from "@/utils/animation-clips";
import { fitObjectToCamera } from "@/utils/camera";
import { parseModel } from "@/utils/model";
import {
  applyMaterialAssignments,
  buildMaterialInventory,
} from "@/utils/material-runtime";
import {
  clearRuntimeModel,
  getRuntimeModel,
  setOriginalRuntimeModel,
} from "@/utils/model-downgrade-runtime";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useMainPanelContext } from "../panels/main/context";
import {
  EMPTY_MATERIAL_INVENTORY,
  useMaterialsStore,
} from "@/store/next/materials";
import { buildAuthoredModelObject } from "@/utils/authored-models";

export function Based({ uuid, ...props }: { uuid: string }) {
  const model = useModel(uuid);
  const authoredRecipe = useAuthoredModelsStore((state) =>
    model?.source === "authored" && model.authoredModelId
      ? state.recipes[model.authoredModelId]
      : undefined,
  );
  const setRef = useRefsStore((state) => state.setRef);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const setClips = useModelsStore((state) => state.setClips);
  const setMixerRef = useModelsStore((state) => state.setMixerRef);

  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const materials = useMaterialsStore((state) => state.materials);
  const assignments = useMaterialsStore((state) => state.assignments);
  const textures = useMaterialsStore((state) => state.textures);
  const inventory = useMaterialsStore(
    (state) => state.inventories[uuid] ?? EMPTY_MATERIAL_INVENTORY,
  );
  const setModelInventory = useMaterialsStore(
    (state) => state.setModelInventory,
  );
  const downgradeEntry = useModelDowngradesStore(
    (state) => state.entries[uuid],
  );
  const activeVariant = downgradeEntry?.activeVariant ?? "original";
  const downgradeRevision = downgradeEntry?.revision ?? 0;
  const animation = useModelsStore((state) => uuid && state.animations[uuid]);
  const clips = useModelsStore((state) => state.clips);
  const durations = useModelsStore((state) => state.durations);
  const speeds = useModelsStore((state) => state.speeds);
  const loops = useModelsStore((state) => state.loops);
  const currentTime = useModelsStore((state) => state.currentTime[uuid]);
  const freeze = useModelsStore((state) => state.freeze[uuid]);
  const setFreeze = useModelsStore((state) => state.setFreeze);

  const { controls } = useMainPanelContext();

  useFrame((_, delta) => {
    if (freeze) return;
    mixerRef.current?.update(delta);
  });

  useEffect(() => {
    const openFile = async () => {
      if (model?.source === "authored") return;
      if (!model?.file) return;

      const format = model.file.name
        .split(".")
        .pop()
        ?.toLowerCase() as ModelComponentType["format"];

      if (!format) return;

      try {
        const parsed = await parseModel(model.file, format);
        const inventory = buildMaterialInventory(parsed.object, uuid);

        setObject(parsed.object);
        setModelInventory(uuid, inventory);
        mixerRef.current = parsed.mixer;

        const camera = controls?.camera;
        if (camera) {
          const scale = fitObjectToCamera(parsed.object, camera, 1);
          parsed.object.scale.setScalar(scale);
        }

        setOriginalRuntimeModel(uuid, {
          object: parsed.object,
          mixer: parsed.mixer,
          clips: parsed.clips,
        });
        setClips(uuid, parsed.clips);
        setMixerRef(uuid, parsed.mixer);

        // Emit event to signal model is ready for use
        PubSub.emit(EventType.MODEL_READY, { uuid });

        const downgrade = useModelDowngradesStore.getState().entries[uuid];
        if (downgrade?.activeVariant === "downgraded") {
          void useModelDowngradesStore.getState().preview(uuid);
        }
      } catch (err) {
        console.error("[sprite-sheet-helper] parseModel failed:", err);
        setMixerRef(uuid, null);
      }
    };

    openFile();
    return () => {
      clearRuntimeModel(uuid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, setClips, setMixerRef, uuid]);

  useEffect(() => {
    if (model?.source !== "authored" || !authoredRecipe) return;

    const built = buildAuthoredModelObject(authoredRecipe);
    const inventory = buildMaterialInventory(built.object, uuid);

    setObject(built.object);
    setModelInventory(uuid, inventory);
    mixerRef.current = null;
    setOriginalRuntimeModel(uuid, {
      object: built.object,
      mixer: null,
      clips: [],
    });
    setClips(uuid, []);
    setMixerRef(uuid, null);
    PubSub.emit(EventType.MODEL_READY, { uuid });
  }, [
    authoredRecipe,
    model?.source,
    setClips,
    setMixerRef,
    setModelInventory,
    uuid,
  ]);

  useEffect(() => {
    const runtime = getRuntimeModel(uuid, activeVariant);
    if (!runtime) return;
    setObject(runtime.object);
    mixerRef.current = runtime.mixer;
    setClips(uuid, runtime.clips);
    setMixerRef(uuid, runtime.mixer);
  }, [activeVariant, downgradeRevision, setClips, setMixerRef, uuid]);

  useEffect(() => {
    if (!object) return;
    let cancelled = false;
    applyMaterialAssignments(
      object,
      uuid,
      inventory,
      materials,
      assignments,
      textures,
    ).catch((error) => {
      if (!cancelled) {
        console.error("[sprite-sheet-helper] material apply failed:", error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assignments, inventory, materials, object, textures, uuid]);

  useEffect(() => {
    const resetAnimations = () => {
      mixerRef.current?.setTime(0);
    };
    PubSub.on(EventType.START_ASSETS_CREATION, resetAnimations);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, resetAnimations);
    };
  }, []);

  useEffect(() => {
    if (!mixerRef.current) {
      console.debug(`[Model] mixerRef not ready for ${uuid}:${animation}`);
      return;
    }

    mixerRef.current.stopAllAction();
    if (!animation || animation === "none") {
      console.debug(`[Model] Animation is "none" for ${uuid}`);
      return;
    }
    const entityClips = clips[uuid];
    const clip = entityClips?.find((c) => c.clip.name === animation);

    if (!entityClips || !clip) {
      console.warn(
        `[Model] No clips found for ${uuid}:${animation}. Available:`,
        entityClips?.map((c) => c.clip.name),
      );
      return;
    }

    const [trimStart, trimEnd] = durations[uuid]?.[animation] ?? [
      0,
      clip.clip.duration,
    ];

    const playbackClip = buildPlaybackClip(
      clip.clip,
      trimStart,
      trimEnd,
      getAnimationClipFps(clip.clip),
    );
    const trimmedClip = playbackClip.clip;

    const action = mixerRef.current.clipAction(trimmedClip);

    action.setDuration(
      (1 / (speeds[uuid]?.[animation] ?? 1)) * trimmedClip.duration,
    );
    action.reset();
    const loop = loops[uuid]?.[animation];
    action.setLoop(loop ?? THREE.LoopOnce, Infinity);
    action.play();

    console.debug(`[Model] Emitting ANIMATION_READY for ${uuid}:${animation}`);
    PubSub.emit(EventType.ANIMATION_READY, { uuid, animation });

    // currentActionRef.current = action;

    return () => {
      action.stop();
      if (playbackClip.generated) {
        mixerRef.current?.uncacheAction(trimmedClip);
        mixerRef.current?.uncacheClip(trimmedClip);
      }
    };
  }, [animation, clips, uuid, durations, speeds, loops]);

  useEffect(() => {
    if (!mixerRef.current || !currentTime) return;
    // currentActionRef.current.paused = true;
    // // currentTime is relative to the subclip, not the original clip
    // const clampedTime = Math.min(
    //   currentTime,
    //   currentActionRef.current.getClip().duration,
    // );
    setFreeze(uuid, true);
    mixerRef.current.setTime(currentTime);
  }, [currentTime, setFreeze, mixerRef, uuid]);

  if (!object) return null;

  return (
    <>
      {/* <FileModel file={model.file!} /> */}
      <mesh
        {...props}
        ref={(ref: THREE.Object3D) => {
          setRef(uuid, ref, "model");
        }}
      >
        <primitive object={object} />
      </mesh>
    </>
  );
}

// Memoized version of the component
export const ModelComponent = React.memo(Based);
