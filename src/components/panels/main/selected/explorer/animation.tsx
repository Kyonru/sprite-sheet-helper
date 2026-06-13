import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { InspectorPanel, type InspectorField } from "@/components/inspector";

const ANIMATION_LOOP_OPTIONS: Record<string, LoopType> = {
  "Loop Once": THREE.LoopOnce,
  "Loop Repeat": THREE.LoopRepeat,
  "Ping Pong": THREE.LoopPingPong,
};

const EMPTY_HIDDEN_ANIMATIONS: string[] = [];

const AnimationDetails = ({ uuid }: { uuid: string }) => {
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
  const hiddenAnimations = useModelsStore(
    (state) => state.hiddenAnimations[uuid] ?? EMPTY_HIDDEN_ANIMATIONS,
  );
  const setAnimationHidden = useModelsStore(
    (state) => state.setAnimationHidden,
  );
  const restoreHiddenAnimations = useModelsStore(
    (state) => state.restoreHiddenAnimations,
  );

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
  const visibleAnimations = useMemo(
    () =>
      animations?.filter(
        (entry) => !hiddenAnimations.includes(entry.clip.name),
      ),
    [animations, hiddenAnimations],
  );
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

  const importFields = useMemo(() => {
    const fields: InspectorField[] = [];
    if (!isModelReady) return fields;

    if (candidateSourceModels.length > 0) {
      const sourceOptionValues = Object.values(importSourceOptions);
      const isSelectionAvailable =
        !!importSourceUuid && sourceOptionValues.includes(importSourceUuid);

      fields.push({
        kind: "select",
        label: "source model",
        options: importSourceOptions,
        value: isSelectionAvailable
          ? importSourceUuid
          : (sourceOptionValues.at(0) ?? ""),
        onChange: (value) => {
          setImportSourceUuid(String(value));
        },
      });
    }

    fields.push({
      kind: "button",
      label: "import from model",
      action: handleImportFromLoadedModel,
      disabled: candidateSourceModels.length === 0,
    });

    fields.push({
      kind: "button",
      label: "import from file",
      action: async () => {
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
                : importForceInPlace &&
                    importInPlaceAxisMode !== "all" &&
                    importInPlaceAxisMode !== "none"
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
      },
    });

    fields.push({
      kind: "boolean",
      label: "force imported in place",
      value: importForceInPlace,
      onChange: (value: boolean) => {
        setImportForceInPlace(value);
      },
    });

    if (importForceInPlace) {
      fields.push({
        kind: "select",
        label: "force imported axes",
        options: IN_PLACE_AXIS_OPTIONS,
        value: importInPlaceAxisMode,
        onChange: (value) => {
          setImportInPlaceAxisMode(normalizeInPlaceAxisMode(String(value)));
        },
      });
    }

    return fields;
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

    if (!visibleAnimations || visibleAnimations.length === 0) {
      toast.error("No animations available to force.");
      return;
    }

    const activeAnimationName =
      animation &&
      animation !== "none" &&
      visibleAnimations.some((clip) => clip.clip.name === animation)
        ? animation
        : visibleAnimations[0]?.clip.name;

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
    currentInPlaceAxisMode,
    forceCurrentAnimationInPlace,
    isModelReady,
    setAnimation,
    uuid,
    visibleAnimations,
  ]);

  const handleHideCurrentAnimation = useCallback(() => {
    if (!animation || animation === "none") {
      toast.error("Select an animation to hide.");
      return;
    }

    setAnimationHidden(uuid, animation, true);
    toast.success(`Animation "${animation}" hidden from this model.`);
  }, [animation, setAnimationHidden, uuid]);

  const handleRestoreHiddenAnimations = useCallback(() => {
    restoreHiddenAnimations(uuid);
    toast.success("Hidden animations restored.");
  }, [restoreHiddenAnimations, uuid]);

  const animationFields = useMemo(() => {
    const fields: InspectorField[] = [];
    if (!uuid) return fields;

    if (
      !entity?.uuid ||
      !uuid ||
      !isModelReady ||
      !visibleAnimations
    ) {
      return fields;
    }

    if (visibleAnimations) {
      fields.push({
        kind: "select",
        label: "force current axes",
        options: IN_PLACE_AXIS_OPTIONS,
        value: currentInPlaceAxisMode,
        onChange: (value) => {
          setCurrentInPlaceAxisMode(normalizeInPlaceAxisMode(String(value)));
        },
      });

      fields.push({
        kind: "button",
        label: "force current animation in place",
        action: handleForceCurrentInPlace,
      });

      const animationOptions = [
        "none",
        ...visibleAnimations.map((clip) => clip.clip.name),
      ];

      fields.push({
        kind: "select",
        label: "animation",
        options: animationOptions,
        value: animation || "none",
        onChange: (value) => {
          setAnimation(uuid, String(value));
        },
      });

      fields.push({
        kind: "button",
        label: "hide selected animation",
        action: handleHideCurrentAnimation,
        disabled: !animation || animation === "none",
      });

      if (hiddenAnimations.length > 0) {
        fields.push({
          kind: "readonly",
          label: "hidden animations",
          value: `${hiddenAnimations.length}`,
        });
        fields.push({
          kind: "button",
          label: "restore hidden animations",
          action: handleRestoreHiddenAnimations,
        });
      }

      const clip = visibleAnimations.find(
        (clip) => clip.clip.name === animation,
      );

      fields.push({
        kind: "readonly",
        label: "length",
        value: `${clip?.clip.duration || 0} seconds`,
      });

      const selectedAnimation = animation || "none";
      const duration = durations[uuid]?.[selectedAnimation];

      fields.push({
        kind: "range",
        label: "duration",
        min: 0,
        max: clip?.clip.duration ?? 0,
        step: 0.1,
        value: duration ?? [0, clip?.clip.duration || 0],
        onChange: (value: [number, number]) => {
          setDuration(uuid, selectedAnimation, value);
        },
        disabled: selectedAnimation === "none",
      });

      fields.push({
        kind: "number",
        label: "speed",
        min: -1,
        max: 3,
        step: 0.1,
        value: speeds[uuid]?.[selectedAnimation] ?? 1,
        onChange: (value: number) => {
          setSpeed(uuid, selectedAnimation, value);
        },
        disabled: selectedAnimation === "none",
      });

      fields.push({
        kind: "select",
        label: "loop",
        options: ANIMATION_LOOP_OPTIONS,
        value: loops[uuid]?.[selectedAnimation] ?? THREE.LoopOnce,
        onChange: (value) => {
          setLoop(uuid, selectedAnimation, Number(value) as LoopType);
        },
        disabled: selectedAnimation === "none",
      });

      fields.push({
        kind: "boolean",
        label: "freeze",
        value: freeze ?? false,
        onChange: (value: boolean) => {
          setFreeze(uuid, value);
        },
      });

      if (freeze) {
        fields.push({
          kind: "number",
          label: "currentTime",
          min: 0,
          max: clip?.clip.duration ?? 0,
          step: 0.1,
          value: currentTime ?? 0,
          onChange: (value: number) => {
            setCurrentTime(uuid, value);
          },
        });
      }
    }

    return fields;
  }, [
    entity?.uuid,
    uuid,
    isModelReady,
    visibleAnimations,
    animation,
    setAnimation,
    hiddenAnimations.length,
    handleHideCurrentAnimation,
    handleRestoreHiddenAnimations,
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

  const fields = useMemo<InspectorField[]>(() => {
    const items: InspectorField[] = [];

    if (isModelReady) {
      items.push({
        kind: "button",
        label: "Create Pose / Motion Clip",
        action: () => openPoseStudio(uuid),
      });
    }

    items.push({
      kind: "group",
      label: "Import Animations",
      fields: importFields,
      hidden: importFields.length === 0,
    });

    items.push({
      kind: "group",
      label: "Animation Settings",
      fields: animationFields,
      hidden: animationFields.length === 0,
    });

    return items;
  }, [animationFields, importFields, isModelReady, uuid]);

  return <InspectorPanel fields={fields} />;
};

export const AnimationContext = () => {
  const selected = useEntitiesStore((state) => state.selected);

  if (!selected) return null;

  return (
    <div className="grid min-h-0 gap-3 pb-8">
      <section className="relative rounded-md border bg-background">
        <AnimationDetails uuid={selected} />
      </section>
    </div>
  );
};
