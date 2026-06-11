import { useEntitiesStore, useEntity } from "@/store/next/entities";
import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
  button,
} from "leva";
import type { Schema } from "leva/plugin";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LEVA_THEME } from "@/constants/theming";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import {
  useModel,
  useModelsStore,
  type LoopType,
} from "@/store/next/models";
import * as THREE from "three";
import { openPoseStudio } from "@/components/camera-animation-capture";
import { toast } from "sonner";
import { importFile } from "@/utils/assets";
import {
  IN_PLACE_AXIS_OPTIONS,
  normalizeInPlaceAxisMode,
  type InPlaceAxisMode,
} from "@/utils/animation-clips";

const ANIMATION_LOOP_OPTIONS: Record<string, LoopType> = {
  "Loop Once": THREE.LoopOnce,
  "Loop Repeat": THREE.LoopRepeat,
  "Ping Pong": THREE.LoopPingPong,
};

const AnimationDetails = ({ uuid }: { uuid: string }) => {
  const store = useStoreContext();
  const entity = useEntity(uuid);
  const model = useModel(uuid);
  const setAnimation = useModelsStore((state) => state.setAnimation);
  const animation = useModelsStore((state) => uuid && state.animations[uuid]);
  const durations = useModelsStore((state) => state.durations);
  const setDuration = useModelsStore((state) => state.setDuration);
  const setSpeed = useModelsStore((state) => state.setSpeed);
  const speeds = useModelsStore((state) => state.speeds);
  const setLoop = useModelsStore((state) => state.setLoop);
  const loops = useModelsStore((state) => state.loops);

  const freeze = useModelsStore((state) => state.freeze[uuid]);
  const setFreeze = useModelsStore((state) => state.setFreeze);

  const currentTime = useModelsStore((state) => state.currentTime[uuid]);
  const setCurrentTime = useModelsStore((state) => state.setCurrentTime);
  const models = useModelsStore((state) => state.models);
  const allClips = useModelsStore((state) => state.clips);
  const importAnimationsFromSource = useModelsStore(
    (state) => state.importAnimationsFromSource,
  );
  const forceCurrentAnimationInPlace = useModelsStore(
    (state) => state.forceCurrentAnimationInPlace,
  );
  const entities = useEntitiesStore((state) => state.entities);

  const animations = useModelsStore((state) => state.clips[uuid]);
  const isModelReady = model?.loadState === "loaded";
  const candidateSourceModels = useMemo(() => {
    const entries = Object.entries(models)
      .filter(
        ([sourceUuid, sourceModel]) =>
          sourceUuid !== uuid &&
          sourceModel.source === "file" &&
          sourceModel.loadState === "loaded" &&
          allClips[sourceUuid]?.length,
      )
      .map(([sourceUuid, sourceModel]) => ({
        uuid: sourceUuid,
        label: entities[sourceUuid]?.name ?? sourceModel.fileName ?? sourceUuid,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    return entries;
  }, [allClips, entities, models, uuid]);

  const importSourceOptions = useMemo(() => {
    const labelCounts = new Map<string, number>();
    for (const entry of candidateSourceModels) {
      labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);
    }
    return Object.fromEntries(
      candidateSourceModels.map((entry) => {
        const hasDuplicateLabel = (labelCounts.get(entry.label) ?? 0) > 1;
        const label = hasDuplicateLabel
          ? `${entry.label} (${entry.uuid})`
          : entry.label;
        return [label, entry.uuid];
      }),
    );
  }, [candidateSourceModels]);

  const [importSourceUuid, setImportSourceUuid] = useState<string | undefined>(
    candidateSourceModels.at(0)?.uuid,
  );
  const [importForceInPlace, setImportForceInPlace] = useState(false);
  const [importInPlaceAxisMode, setImportInPlaceAxisMode] =
    useState<InPlaceAxisMode>("all");
  const [currentInPlaceAxisMode, setCurrentInPlaceAxisMode] =
    useState<InPlaceAxisMode>("all");

  useEffect(() => {
    setImportSourceUuid((current) => {
      if (
        current &&
        candidateSourceModels.some((entry) => entry.uuid === current)
      ) {
        return current;
      }

      return candidateSourceModels.at(0)?.uuid;
    });
  }, [candidateSourceModels]);

  const handleImportFromLoadedModel = useCallback(async () => {
    if (!isModelReady) {
      toast.error("Model must be loaded before importing animations.");
      return;
    }

    if (!importSourceUuid) {
      toast.error("Select a source model first.");
      return;
    }

    try {
      const { importedNames } = await importAnimationsFromSource(uuid, {
        sourceModelUuid: importSourceUuid,
        forceInPlace: importForceInPlace,
        inPlaceAxisMode: importInPlaceAxisMode,
      });

      if (importedNames.length === 0) {
        toast.info("No animations found in source model.");
        return;
      }

      const modeSuffix =
        importForceInPlace && importInPlaceAxisMode === "horizontal"
          ? " with horizontal motion frozen"
          : importForceInPlace && importInPlaceAxisMode !== "all" && importInPlaceAxisMode !== "none"
            ? ` with ${importInPlaceAxisMode.toUpperCase()} motion frozen`
          : "";
      toast.success(
        `Imported ${importedNames.length} animation(s)${modeSuffix}: ${importedNames.join(", ")}`,
      );
    } catch (error) {
      toast.error("Failed to import animations from model", {
        description: (error as Error).message,
      });
    }
  }, [
    importForceInPlace,
    importInPlaceAxisMode,
    importAnimationsFromSource,
    importSourceUuid,
    isModelReady,
    uuid,
  ]);

  const importInputs = useMemo(() => {
    const i: Schema = {};
    if (!isModelReady) return i;

    if (candidateSourceModels.length > 0) {
      const sourceOptionValues = Object.values(importSourceOptions);
      const isSelectionAvailable =
        !!importSourceUuid && sourceOptionValues.includes(importSourceUuid);

      i["source model"] = {
        options: importSourceOptions,
        value: isSelectionAvailable
          ? importSourceUuid
          : sourceOptionValues.at(0),
        onChange: (value: string) => {
          setImportSourceUuid(value);
        },
      };
      i["import from model"] = button(handleImportFromLoadedModel);
    } else {
      i["import from model"] = button(handleImportFromLoadedModel);
    }

    i["import from file"] = button(async () => {
      if (!isModelReady) {
        toast.error("Model must be loaded before importing animations.");
        return;
      }

      importFile(ACCEPTED_MODEL_FILE_TYPES, async (file) => {
        try {
          const { importedNames } = await importAnimationsFromSource(uuid, {
            sourceFile: file,
            forceInPlace: importForceInPlace,
            inPlaceAxisMode: importInPlaceAxisMode,
          });

          if (importedNames.length === 0) {
            toast.info("No animations found in source file.");
            return;
          }

          const modeSuffix =
            importForceInPlace && importInPlaceAxisMode === "horizontal"
              ? " with horizontal motion frozen"
              : importForceInPlace && importInPlaceAxisMode !== "all" && importInPlaceAxisMode !== "none"
                ? ` with ${importInPlaceAxisMode.toUpperCase()} motion frozen`
              : "";
          toast.success(
            `Imported ${importedNames.length} animation(s) from file${modeSuffix}: ${importedNames.join(", ")}`,
          );
        } catch (error) {
          toast.error("Failed to import animations from file", {
            description: (error as Error).message,
          });
        }
      });
    });

    i["force imported in place"] = {
      value: importForceInPlace,
      onChange: (value: boolean) => {
        setImportForceInPlace(value);
      },
    };

    if (importForceInPlace) {
      i["force imported axes"] = {
        options: IN_PLACE_AXIS_OPTIONS,
        value: importInPlaceAxisMode,
        onChange: (value: string) => {
          setImportInPlaceAxisMode(normalizeInPlaceAxisMode(value));
        },
      };
    }

    return i;
  }, [
    candidateSourceModels.length,
    handleImportFromLoadedModel,
    importSourceOptions,
    importForceInPlace,
    importInPlaceAxisMode,
    importSourceUuid,
    isModelReady,
    importAnimationsFromSource,
    uuid,
  ]);

  const handleForceCurrentInPlace = useCallback(async () => {
    if (!isModelReady) {
      toast.error("Model must be loaded before forcing animation in place.");
      return;
    }

    if (!animations || animations.length === 0) {
      toast.error("No animations available to force.");
      return;
    }

    const activeAnimationName =
      animation && animation !== "none" && animations.some((clip) => clip.clip.name === animation)
        ? animation
        : animations[0]?.clip.name;

    if (!activeAnimationName) {
      toast.error("Select an animation first.");
      return;
    }

    try {
      const { name } = forceCurrentAnimationInPlace(
        uuid,
        activeAnimationName,
        currentInPlaceAxisMode,
      );
      if (activeAnimationName !== animation) {
        setAnimation(uuid, activeAnimationName);
      }
      const modeSuffix =
        currentInPlaceAxisMode === "horizontal"
          ? " with horizontal motion frozen"
          : currentInPlaceAxisMode !== "all" && currentInPlaceAxisMode !== "none"
            ? ` with ${currentInPlaceAxisMode.toUpperCase()} motion frozen`
          : "";
      toast.success(
        currentInPlaceAxisMode === "none"
          ? `Animation "${name}" restored to original root motion.`
          : `Animation "${name}" forced in place${modeSuffix}.`,
      );
    } catch (error) {
      toast.error("Failed to force animation in place", {
        description: (error as Error).message,
      });
    }
  }, [
    animation,
    animations,
    currentInPlaceAxisMode,
    forceCurrentAnimationInPlace,
    isModelReady,
    setAnimation,
    uuid,
  ]);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    if (
      !entity?.uuid ||
      !uuid ||
      !isModelReady ||
      !animations
    ) {
      return {};
    }

    if (animations) {
      i["force current axes"] = {
        options: IN_PLACE_AXIS_OPTIONS,
        value: currentInPlaceAxisMode,
        onChange: (value: string) => {
          setCurrentInPlaceAxisMode(normalizeInPlaceAxisMode(value));
        },
      };

      i["force current animation in place"] = button(
        handleForceCurrentInPlace,
      );

      const animationOptions = [
        "none",
        ...animations.map((clip) => clip.clip.name),
      ];

      i["animation"] = {
        options: animationOptions,
        value: animation || "none",
        onChange: (value: string) => {
          setAnimation(uuid, value);
        },
      };
      const clip = animations.find((clip) => clip.clip.name === animation);

      i["length"] = {
        value: `${clip?.clip.duration || 0} seconds`,
        editable: false,
      };

      const duration = durations[uuid]?.[animation];

      i["duration"] = {
        min: 0,
        max: clip?.clip.duration ?? 0,
        step: 0.1,
        value: duration ?? [0, clip?.clip.duration || 0],
        onChange: (value: [number, number]) => {
          setDuration(uuid, animation, value);
        },
      };

      i["speed"] = {
        min: -1,
        max: 3,
        step: 0.1,
        value: speeds[uuid]?.[animation] ?? 1,
        onChange: (value: number) => {
          setSpeed(uuid, animation, value);
        },
      };

      i["loop"] = {
        options: ANIMATION_LOOP_OPTIONS,
        value: loops[uuid]?.[animation] ?? THREE.LoopOnce,
        onChange: (value: LoopType) => {
          setLoop(uuid, animation, value);
        },
      };

      i["freeze"] = {
        value: freeze ?? false,
        onChange: (value: boolean) => {
          setFreeze(uuid, value);
        },
      };

      if (freeze) {
        i["currentTime"] = {
          min: 0,
          max: clip?.clip.duration ?? 0,
          step: 0.1,
          value: currentTime ?? 0,
          onChange: (value: number) => {
            setCurrentTime(uuid, value);
          },
        };
      }
    }

    return i;
  }, [
    entity?.uuid,
    uuid,
    isModelReady,
    animations,
    animation,
    setAnimation,
    durations,
    setDuration,
    speeds,
    setSpeed,
    loops,
    setLoop,
    freeze,
    setFreeze,
    currentTime,
    setCurrentTime,
    currentInPlaceAxisMode,
    handleForceCurrentInPlace,
  ]);

  useControls(
    () =>
      ({
        ...(isModelReady
          ? { "Create Pose / Motion Clip": button(() => openPoseStudio(uuid)) }
          : {}),
      }) satisfies Schema,
    { store },
    [uuid, isModelReady],
  );

  useControls(() => importInputs satisfies Schema, { store }, [
    uuid,
    importInputs,
  ]);

  // Function form + key forces Leva to remount when entity/type changes
  const [, set] = useControls(() => inputs satisfies Schema, { store }, [
    uuid,
    animation,
    currentInPlaceAxisMode,
    handleForceCurrentInPlace,
  ]);

  useEffect(() => {
    if (!animations) return;

    const clip = animations.find((clip) => clip.clip.name === animation);

    set({
      length: `${clip?.clip.duration ?? 0} seconds`,
    });
  }, [uuid, set, animation, animations]);

  return (
    <LevaPanel
      theme={LEVA_THEME}
      hidden={false}
      neverHide
      store={store}
      fill
      flat
      titleBar={false}
    />
  );
};

export const AnimationContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const animationStore = useCreateStore();

  if (!selected) return null;

  return (
    <LevaStoreProvider key={selected} store={animationStore}>
      <AnimationDetails uuid={selected} />
    </LevaStoreProvider>
  );
};
