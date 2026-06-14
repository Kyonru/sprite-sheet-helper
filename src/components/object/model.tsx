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
import { disposeParsedModel, parseModel, type ParsedModel } from "@/utils/model";
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
import { toast } from "sonner";

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
  const setLoadState = useModelsStore((state) => state.setLoadState);

  const loadRequestRef = useRef(0);
  const parsedModelRef = useRef<ParsedModel | null>(null);
  const autoFitObjectRef = useRef<THREE.Object3D | null>(null);

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
    const requestId = ++loadRequestRef.current;
    const openFile = async () => {
      if (!model || model.source === "authored") return;
      if (!model.file) return;

      const format = model.file.name
        .split(".")
        .pop()
        ?.toLowerCase() as ModelComponentType["format"];

      if (!format) return;

      clearRuntimeModel(uuid);
      setObject(null);
      setModelInventory(uuid, EMPTY_MATERIAL_INVENTORY);
      setClips(uuid, [], { applyPersistedImports: false });
      setMixerRef(uuid, null);
      mixerRef.current = null;
      setLoadState(uuid, "loading");

      let parsedModel: ParsedModel | null = null;
      try {
        const parsed = await parseModel(model.file, format);
        parsedModel = parsed;
        parsedModelRef.current = parsed;

        if (loadRequestRef.current !== requestId) {
          disposeParsedModel(parsed);
          if (parsedModelRef.current === parsed) {
            parsedModelRef.current = null;
          }
          return;
        }

        const inventory = buildMaterialInventory(parsed.object, uuid);
        setObject(parsed.object);
        setModelInventory(uuid, inventory);
        mixerRef.current = parsed.mixer;

        setOriginalRuntimeModel(uuid, {
          object: parsed.object,
          mixer: parsed.mixer,
          clips: parsed.clips,
        });
        setMixerRef(uuid, parsed.mixer);
        setClips(uuid, parsed.clips);
        const loadedState = useModelsStore.getState();
        setOriginalRuntimeModel(uuid, {
          object: parsed.object,
          mixer: loadedState.mixerRef[uuid] ?? parsed.mixer,
          clips: loadedState.clips[uuid] ?? parsed.clips,
        });
        setLoadState(uuid, "loaded");
        PubSub.emit(EventType.MODEL_READY, { uuid });

        const downgrade = useModelDowngradesStore.getState().entries[uuid];
        if (downgrade?.activeVariant === "downgraded") {
          void useModelDowngradesStore.getState().preview(uuid);
        }
      } catch (err) {
        if (loadRequestRef.current !== requestId) return;

        console.error("[sprite-sheet-helper] parseModel failed:", err);
        const message =
          err instanceof Error ? err.message : "Unknown model parse error";
        setObject(null);
        setModelInventory(uuid, EMPTY_MATERIAL_INVENTORY);
        setClips(uuid, [], { applyPersistedImports: false });
        setMixerRef(uuid, null);
        setLoadState(uuid, "error", message);
        clearRuntimeModel(uuid);
        if (parsedModel) {
          disposeParsedModel(parsedModel);
        }
        parsedModelRef.current = null;
        toast.error("Failed to load model", {
          description: message,
        });
      }
    };

    openFile();
    return () => {
      loadRequestRef.current += 1;
      if (parsedModelRef.current) {
        disposeParsedModel(parsedModelRef.current);
        parsedModelRef.current = null;
      }
      clearRuntimeModel(uuid);
      setObject(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.file, model?.source, setClips, setLoadState, setModelInventory, setMixerRef, uuid]);

  useEffect(() => {
    if (!object) return;
    if (model?.source !== "file") return;
    if (model.autoFitOnLoad === false) return;
    if (!controls?.camera) return;
    if (autoFitObjectRef.current === object) return;

    const scale = fitObjectToCamera(object, controls.camera, 1);
    object.scale.setScalar(scale);
    object.updateMatrixWorld(true);
    autoFitObjectRef.current = object;
  }, [controls?.camera, model?.autoFitOnLoad, model?.source, object]);

  useEffect(() => {
    if (model?.source !== "authored" || !authoredRecipe) return;

    const built = buildAuthoredModelObject(authoredRecipe);
    const inventory = buildMaterialInventory(built.object, uuid);
    clearRuntimeModel(uuid);
    setObject(null);

    setObject(built.object);
    setModelInventory(uuid, inventory);
    mixerRef.current = null;
    setOriginalRuntimeModel(uuid, {
      object: built.object,
      mixer: null,
      clips: [],
    });
    setClips(uuid, []);
    const loadedState = useModelsStore.getState();
    setMixerRef(uuid, loadedState.mixerRef[uuid] ?? null);
    setOriginalRuntimeModel(uuid, {
      object: built.object,
      mixer: loadedState.mixerRef[uuid] ?? null,
      clips: loadedState.clips[uuid] ?? [],
    });
    setLoadState(uuid, "loaded");
    PubSub.emit(EventType.MODEL_READY, { uuid });
  }, [
    authoredRecipe,
    model?.source,
    setClips,
    setLoadState,
    setMixerRef,
    setModelInventory,
    uuid,
  ]);

  useEffect(() => {
    const runtime = getRuntimeModel(uuid, activeVariant);
    if (!runtime) return;
    setObject(runtime.object);
    mixerRef.current = runtime.mixer;
    setClips(uuid, runtime.clips, { applyPersistedImports: false });
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
