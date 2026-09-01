import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  WorkflowIcon,
} from "lucide-react";
import { useWorkflow } from "@/hooks/next/use-workflow";
import {
  WORKFLOW_PRESETS,
  type WorkflowDefinition,
  type WorkflowId,
} from "@/constants/workflows";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore } from "@/store/next/images";
import { EventType, PubSub } from "@/lib/events";
import { WorkflowMatrix } from "@/components/workflows/workflow-matrix";
import { WorkflowStage } from "@/components/workflows/workflow-stage";
import {
  WorkflowAnimationSection,
  WorkflowCaptureSection,
} from "@/components/workflows/workflow-settings";
import { WorkflowRunStatus } from "@/components/workflows/workflow-run-status";
import * as THREE from "three";
import {
  normalizeWorkflowDegrees,
  resolveWorkflowCamera,
  type WorkflowCameraTarget,
  type WorkflowRunOptions,
} from "@/utils/workflow-camera";
import {
  getAnimationClipFps,
  type InPlaceAxisMode,
} from "@/utils/animation-clips";
import { useCamerasStore } from "@/store/next/cameras";
import { useTarget } from "@/store/next/targets";
import { useModelsStore } from "@/store/next/models";
import type { CameraType } from "@/types/camera";
import { getCaptureCycleSeconds, getClipFrameCount } from "@/utils/capture-timing";
import {
  buildWorkflowSteps,
  getHiddenWorkflowStepLabels,
  getWorkflowAnimationGroupKey,
  groupWorkflowStepsByAnimation,
  type WorkflowCaptureSettingsByAnimation,
  type WorkflowCaptureSettingsInput,
  type WorkflowStep,
  type WorkflowStepGroup,
} from "@/utils/workflows";

const EMPTY_STEP_CLIPS: [] = [];
const EMPTY_ANIMATION_METADATA: Record<string, never> = {};

type PreviewAppliesTo = "all" | "selected";

type WorkflowCameraDraft = {
  distance: number;
  elevationAngle: number;
  cameraType: CameraType;
  directionRotationOffset: number;
  target: WorkflowCameraTarget;
  selectedDirectionLabel: string;
  previewAppliesTo: PreviewAppliesTo;
  directionOverrides: NonNullable<WorkflowRunOptions["directionOverrides"]>;
  forceAnimationsInPlace: boolean;
  forceAnimationsInPlaceMode: InPlaceAxisMode;
  skippedStepLabels: string[];
  captureNormalMaps: boolean;
  captureSettingsByAnimation: WorkflowCaptureSettingsByAnimation;
  matchClipLength: boolean;
  isolateModels: boolean;
  autoFit: boolean;
  fitMargin: number;
};

type WorkflowCameraSnapshot = Pick<
  WorkflowCameraDraft,
  | "distance"
  | "elevationAngle"
  | "cameraType"
  | "directionRotationOffset"
  | "target"
  | "directionOverrides"
>;

type StartWorkflowPayload =
  | WorkflowId
  | {
      workflowId?: WorkflowId;
      options?: WorkflowRunOptions;
    };

function cloneTarget(target: WorkflowCameraTarget): WorkflowCameraTarget {
  return [target[0], target[1], target[2]];
}

function cloneDirectionOverrides(
  overrides: WorkflowCameraDraft["directionOverrides"],
): WorkflowCameraDraft["directionOverrides"] {
  return Object.fromEntries(
    Object.entries(overrides).map(([label, override]) => [
      label,
      {
        ...override,
        ...(override.target ? { target: cloneTarget(override.target) } : {}),
      },
    ]),
  );
}

function createCameraSnapshot(
  draft: WorkflowCameraDraft,
): WorkflowCameraSnapshot {
  return {
    distance: draft.distance,
    elevationAngle: draft.elevationAngle,
    cameraType: draft.cameraType,
    directionRotationOffset: draft.directionRotationOffset,
    target: cloneTarget(draft.target),
    directionOverrides: cloneDirectionOverrides(draft.directionOverrides),
  };
}

function createCameraDraft({
  workflow,
  cameraDistance,
  cameraAngle,
  cameraType,
  target,
  captureNormalMaps,
  skippedStepLabels = [],
}: {
  workflow: WorkflowDefinition;
  cameraDistance: number;
  cameraAngle?: number;
  cameraType: CameraType;
  target: WorkflowCameraTarget;
  captureNormalMaps: boolean;
  skippedStepLabels?: string[];
}): WorkflowCameraDraft {
  const firstDirection = workflow.directions[0];
  return {
    distance: cameraDistance,
    elevationAngle: cameraAngle ?? firstDirection?.phi ?? 45,
    cameraType,
    directionRotationOffset: 0,
    target: cloneTarget(target),
    selectedDirectionLabel: firstDirection?.label ?? "",
    previewAppliesTo: "all",
    directionOverrides: {},
    forceAnimationsInPlace: false,
    forceAnimationsInPlaceMode: "all",
    skippedStepLabels: [...skippedStepLabels],
    captureNormalMaps,
    captureSettingsByAnimation: {},
    matchClipLength: true,
    isolateModels: false,
    autoFit: false,
    fitMargin: 0,
  };
}

function createRunOptions(draft: WorkflowCameraDraft): WorkflowRunOptions {
  return {
    cameraDistance: draft.distance,
    cameraAngle: draft.elevationAngle,
    cameraType: draft.cameraType,
    directionRotationOffset: draft.directionRotationOffset,
    target: cloneTarget(draft.target),
    directionOverrides: draft.directionOverrides,
    forceAnimationsInPlace: draft.forceAnimationsInPlace,
    forceAnimationsInPlaceMode: draft.forceAnimationsInPlaceMode,
    skipStepLabels: draft.skippedStepLabels,
    includeHiddenAnimations: true,
    captureNormalMaps: draft.captureNormalMaps,
    captureSettingsByAnimation: draft.captureSettingsByAnimation,
    matchClipLength: draft.matchClipLength,
    isolateModels: draft.isolateModels,
    // Manual stays the default, so an existing project's framing is unchanged
    // until someone asks for the solve.
    ...(draft.autoFit
      ? {
          fit: {
            mode: "auto" as const,
            margin: draft.fitMargin,
            marginUnit: "px" as const,
          },
        }
      : {}),
  };
}

function positiveIntegerInput(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.round(value)));
}

export const WorkflowsMenu = () => {
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cameraDraft, setCameraDraft] = useState<WorkflowCameraDraft | null>(
    null,
  );
  const [selectedStepLabel, setSelectedStepLabel] = useState<
    string | undefined
  >(undefined);
  const [selectedAnimationKey, setSelectedAnimationKey] = useState<
    string | undefined
  >(undefined);
  const [originalCameraSnapshot, setOriginalCameraSnapshot] =
    useState<WorkflowCameraSnapshot | null>(null);

  const {
    workflowState,
    runWorkflow,
    abortWorkflow,
    resetWorkflow,
    presets,
    canRunWorkflow,
  } = useWorkflow();

  const cameraDistance = useSettingsStore((state) => state.cameraDistance);
  const cameraAngle = useSettingsStore((state) => state.cameraAngle);
  const setCameraDistance = useSettingsStore(
    (state) => state.setCameraDistance,
  );
  const setCameraAngle = useSettingsStore((state) => state.setCameraAngle);
  const exportNormalMap = useSettingsStore((state) => state.exportNormalMap);
  const exportWidth = useSettingsStore((state) => state.exportWidth);
  const exportHeight = useSettingsStore((state) => state.exportHeight);
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const mainCameraType = useCamerasStore(
    (state) => state.cameras[cameraUUID || ""]?.type,
  );
  const setCameraType = useCamerasStore((state) => state.setCameraType);
  const setCamera = useCamerasStore((state) => state.setCamera);
  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const setIterations = useImagesStore((state) => state.setIterations);
  const storedTarget = useTarget(cameraUUID);
  const defaultTarget = useMemo<WorkflowCameraTarget>(() => {
    const target: WorkflowCameraTarget = storedTarget ?? [0, 0, 0];
    return cloneTarget(target);
  }, [storedTarget]);
  const workflowClips = useModelsStore((state) => state.clips);
  const workflowModels = useModelsStore((state) => state.models);
  const hiddenAnimations = useModelsStore((state) => state.hiddenAnimations);
  const workflowDurations = useModelsStore((state) => state.durations);
  const workflowSpeeds = useModelsStore((state) => state.speeds);

  const steps = useMemo(
    () =>
      selectedWorkflow
        ? buildWorkflowSteps(selectedWorkflow, {
            clips: workflowClips,
            hiddenAnimations,
            includeHiddenAnimations: true,
            modelUuids: Object.keys(workflowModels),
          })
        : [],
    [hiddenAnimations, selectedWorkflow, workflowClips, workflowModels],
  );
  const stepGroups = useMemo(
    () => groupWorkflowStepsByAnimation(steps),
    [steps],
  );
  const stepGroupByKey = useMemo(
    () => new Map(stepGroups.map((group) => [group.key, group] as const)),
    [stepGroups],
  );
  const enabledSteps = useMemo(
    () =>
      steps.filter(
        (step) =>
          !step.rowLabel ||
          !cameraDraft?.skippedStepLabels.includes(step.rowLabel),
      ),
    [cameraDraft?.skippedStepLabels, steps],
  );
  const enabledStepOrder = useMemo(
    () =>
      new Map(
        enabledSteps.map((step, index) => [step.rowLabel, index + 1] as const),
      ),
    [enabledSteps],
  );
  const isRunning = workflowState.status === "running";
  const isDone = workflowState.status === "done";
  const selectedDirection = useMemo(() => {
    if (!selectedWorkflow) return undefined;
    return (
      selectedWorkflow.directions.find(
        (dir) => dir.label === cameraDraft?.selectedDirectionLabel,
      ) ?? selectedWorkflow.directions[0]
    );
  }, [cameraDraft?.selectedDirectionLabel, selectedWorkflow]);
  const previewDirection = useMemo(
    () => selectedDirection ?? selectedWorkflow?.directions[0],
    [selectedDirection, selectedWorkflow],
  );
  /**
   * What each animation will actually capture, so the grid can show it and the
   * footer can add it up. The same resolution the runner performs per step:
   * the animation's own settings, then the run's, then the clip when matching.
   */
  const framesByAnimation = useMemo(() => {
    const frames: Record<string, number> = {};

    for (const group of stepGroups) {
      const step = group.steps[0];
      const override = cameraDraft?.captureSettingsByAnimation[group.key];
      const interval = override?.frameIntervalMs ?? intervals;
      const count = override?.frameCount ?? iterations;
      const matches =
        override?.matchClipLength ?? cameraDraft?.matchClipLength ?? false;

      const clip = step?.modelUuid
        ? workflowClips[step.modelUuid]?.find(
            (entry) => entry.clip.name === step.animationName,
          )?.clip
        : undefined;
      const cycle = clip
        ? getCaptureCycleSeconds({
            duration: clip.duration,
            trim: workflowDurations[step.modelUuid ?? ""]?.[step.animationName],
            speed: workflowSpeeds[step.modelUuid ?? ""]?.[step.animationName],
          })
        : 0;

      frames[group.key] =
        matches && cycle > 0
          ? getClipFrameCount(cycle, 1000 / Math.max(1, interval))
          : count;
    }

    return frames;
  }, [
    cameraDraft?.captureSettingsByAnimation,
    cameraDraft?.matchClipLength,
    intervals,
    iterations,
    stepGroups,
    workflowClips,
    workflowDurations,
    workflowSpeeds,
  ]);

  /** Frames the whole run will write, for the line above the button. */
  const plannedFrames = useMemo(() => {
    const skipped = new Set(cameraDraft?.skippedStepLabels ?? []);
    return stepGroups.reduce((total, group) => {
      const enabled = group.steps.filter(
        (step) => !skipped.has(step.rowLabel),
      ).length;
      return total + enabled * (framesByAnimation[group.key] ?? 0);
    }, 0);
  }, [cameraDraft?.skippedStepLabels, framesByAnimation, stepGroups]);

  /** Steps already captured in this run, for the grid's progress fills. */
  const capturedStepLabels = useMemo(() => {
    if (workflowState.status !== "running") return new Set<string>();
    const captured = new Set<string>();
    for (const [label, index] of enabledStepOrder) {
      if (index < workflowState.currentStep) captured.add(label);
    }
    return captured;
  }, [enabledStepOrder, workflowState.currentStep, workflowState.status]);

  const selectedStep = useMemo(
    () => steps.find((step) => step.rowLabel === selectedStepLabel) ?? steps[0],
    [selectedStepLabel, steps],
  );
  const selectedAnimationGroup = useMemo(() => {
    if (selectedAnimationKey) {
      const group = stepGroupByKey.get(selectedAnimationKey);
      if (group) return group;
    }

    if (selectedStep) {
      const group = stepGroupByKey.get(
        getWorkflowAnimationGroupKey(selectedStep),
      );
      if (group) return group;
    }

    return stepGroups[0];
  }, [selectedAnimationKey, selectedStep, stepGroupByKey, stepGroups]);
  const firstEnabledStepLabel = useMemo(
    () =>
      enabledSteps.find((step) => step.rowLabel)?.rowLabel ??
      steps[0]?.rowLabel,
    [enabledSteps, steps],
  );
  const selectedStepModelUuid = selectedStep?.modelUuid;
  const selectedStepAnimationName = selectedStep?.animationName;
  const selectedStepModelClips = useModelsStore(
    (state) =>
      (selectedStepModelUuid
        ? state.clips[selectedStepModelUuid]
        : undefined) ?? EMPTY_STEP_CLIPS,
  );
  const selectedStepDurations = useModelsStore(
    (state) =>
      (selectedStepModelUuid
        ? state.durations[selectedStepModelUuid]
        : undefined) ?? EMPTY_ANIMATION_METADATA,
  );
  const selectedStepLoops = useModelsStore(
    (state) =>
      (selectedStepModelUuid
        ? state.loops[selectedStepModelUuid]
        : undefined) ?? EMPTY_ANIMATION_METADATA,
  );
  const setStepDuration = useModelsStore((state) => state.setDuration);
  const setStepLoop = useModelsStore((state) => state.setLoop);
  const selectedStepClip = useMemo(() => {
    if (!selectedStepModelUuid || !selectedStepAnimationName) return undefined;
    return selectedStepModelClips.find(
      (entry) => entry.clip.name === selectedStepAnimationName,
    );
  }, [
    selectedStepAnimationName,
    selectedStepModelClips,
    selectedStepModelUuid,
  ]);
  const selectedStepRange = useMemo<[number, number] | undefined>(() => {
    if (!selectedStepModelUuid || !selectedStepAnimationName) return undefined;
    if (selectedStepDurations[selectedStepAnimationName]) {
      return selectedStepDurations[selectedStepAnimationName];
    }

    if (!selectedStepClip) return undefined;
    return [0, selectedStepClip.clip.duration];
  }, [
    selectedStepAnimationName,
    selectedStepClip,
    selectedStepDurations,
    selectedStepModelUuid,
  ]);
  const selectedStepFps = selectedStepClip
    ? getAnimationClipFps(selectedStepClip.clip, 30)
    : 30;
  const selectedStepStartFrame = useMemo(() => {
    if (!selectedStepRange) return 0;
    return Math.max(0, Math.round(selectedStepRange[0] * selectedStepFps));
  }, [selectedStepRange, selectedStepFps]);
  const selectedStepLengthFrames = useMemo(() => {
    if (!selectedStepRange) return 0;
    return Math.max(
      0,
      Math.round(
        (selectedStepRange[1] - selectedStepRange[0]) * selectedStepFps,
      ),
    );
  }, [selectedStepRange, selectedStepFps]);
  const selectedStepLoop = useMemo(
    () =>
      selectedStepModelUuid && selectedStepAnimationName
        ? (selectedStepLoops[selectedStepAnimationName] ?? THREE.LoopOnce)
        : THREE.LoopOnce,
    [selectedStepAnimationName, selectedStepLoops, selectedStepModelUuid],
  );
  const selectedStepCycleSeconds = useMemo(
    () =>
      selectedStepClip
        ? getCaptureCycleSeconds({
            duration: selectedStepClip.clip.duration,
            trim: selectedStepRange,
          })
        : 0,
    [selectedStepClip, selectedStepRange],
  );

  const selectedAnimationCaptureSettings =
    selectedAnimationGroup && cameraDraft
      ? cameraDraft.captureSettingsByAnimation[selectedAnimationGroup.key]
      : undefined;
  const selectedFrameIntervalMs =
    selectedAnimationCaptureSettings?.frameIntervalMs ?? intervals;
  const selectedFrameCount =
    selectedAnimationCaptureSettings?.frameCount ?? iterations;
  const hasSelectedCaptureOverride = Boolean(
    selectedAnimationCaptureSettings?.frameIntervalMs ||
      selectedAnimationCaptureSettings?.frameCount ||
      selectedAnimationCaptureSettings?.matchClipLength !== undefined,
  );
  const selectedMatchesClipLength =
    selectedAnimationCaptureSettings?.matchClipLength ??
    cameraDraft?.matchClipLength ??
    false;
  const selectedClipFrames = getClipFrameCount(
    selectedStepCycleSeconds,
    1000 / selectedFrameIntervalMs,
  );
  const selectedCapturedFrames = selectedMatchesClipLength
    ? selectedClipFrames
    : selectedFrameCount;
  const selectedCaptureOverruns =
    selectedStepCycleSeconds > 0 && selectedCapturedFrames > selectedClipFrames;
  const updateStepAnimationRange = useCallback(
    (startFrame: number, durationFrames: number) => {
      if (
        !selectedStepModelUuid ||
        !selectedStepAnimationName ||
        !selectedStepClip ||
        selectedStepAnimationName === "none"
      ) {
        return;
      }

      const clipFrameCount = Math.max(
        0,
        Math.round(selectedStepClip.clip.duration * selectedStepFps),
      );
      const maxStartFrame = Math.max(0, Math.max(clipFrameCount - 1, 0));
      const safeStartFrame = Number.isFinite(startFrame)
        ? Math.max(0, Math.min(Math.floor(startFrame), maxStartFrame))
        : 0;
      const requestedDuration = Number.isFinite(durationFrames)
        ? Math.max(1, Math.floor(durationFrames))
        : 1;
      const maxDuration = Math.max(1, clipFrameCount - safeStartFrame);
      const safeDuration = Math.min(requestedDuration, maxDuration);
      const startSeconds =
        clipFrameCount > 0 ? safeStartFrame / selectedStepFps : 0;
      const endSeconds =
        clipFrameCount > 0
          ? Math.min(
              (safeStartFrame + safeDuration) / selectedStepFps,
              selectedStepClip.clip.duration,
            )
          : 0;

      setStepDuration(selectedStepModelUuid, selectedStepAnimationName, [
        startSeconds,
        endSeconds,
      ]);
    },
    [
      selectedStepAnimationName,
      selectedStepClip,
      selectedStepFps,
      selectedStepModelUuid,
      setStepDuration,
    ],
  );

  useEffect(() => {
    if (steps.length === 0) {
      setSelectedStepLabel(undefined);
      setSelectedAnimationKey(undefined);
      return;
    }

    setSelectedStepLabel((current) => {
      if (current && steps.some((step) => step.rowLabel === current)) {
        return current;
      }

      return firstEnabledStepLabel;
    });
  }, [firstEnabledStepLabel, steps]);

  useEffect(() => {
    setSelectedAnimationKey((current) => {
      if (current && stepGroupByKey.has(current)) return current;
      if (selectedStep) return getWorkflowAnimationGroupKey(selectedStep);
      return stepGroups[0]?.key;
    });
  }, [selectedStep, stepGroupByKey, stepGroups]);

  const shouldShowStepControls = Boolean(
    selectedStep &&
    selectedStep.modelUuid &&
    selectedStepAnimationName &&
    selectedStepAnimationName !== "none" &&
    selectedStepClip,
  );

  const setStepLabelsEnabled = useCallback(
    (labels: string[], enabled: boolean) => {
      const uniqueLabels = Array.from(new Set(labels));
      const labelSet = new Set(uniqueLabels);

      setCameraDraft((prev) =>
        prev
          ? {
              ...prev,
              skippedStepLabels: enabled
                ? prev.skippedStepLabels.filter((label) => !labelSet.has(label))
                : Array.from(
                    new Set([...prev.skippedStepLabels, ...uniqueLabels]),
                  ),
            }
          : prev,
      );
    },
    [],
  );

  const selectWorkflowStep = useCallback((step: WorkflowStep) => {
    setSelectedStepLabel(step.rowLabel);
    setSelectedAnimationKey(getWorkflowAnimationGroupKey(step));
    setCameraDraft((prev) =>
      prev
        ? {
            ...prev,
            selectedDirectionLabel: step.directionLabel,
          }
        : prev,
    );
  }, []);

  const selectWorkflowAnimationGroup = useCallback(
    (group: WorkflowStepGroup) => {
      setSelectedAnimationKey(group.key);

      const selectedGroupStep =
        group.steps.find(
          (step) => !cameraDraft?.skippedStepLabels.includes(step.rowLabel),
        ) ?? group.steps[0];

      if (selectedGroupStep) {
        selectWorkflowStep(selectedGroupStep);
      }
    },
    [cameraDraft?.skippedStepLabels, selectWorkflowStep],
  );

  const updateAnimationCaptureSettings = useCallback(
    (animationKey: string, settings: WorkflowCaptureSettingsInput) => {
      setCameraDraft((prev) => {
        if (!prev) return prev;

        const current = prev.captureSettingsByAnimation[animationKey] ?? {};
        const next = {
          ...current,
          ...settings,
          // Typing a frame count is a decision about the frame count, so it
          // stops the clip deciding it — otherwise the number would be
          // accepted and then quietly ignored at capture time.
          ...(settings.frameCount !== undefined &&
          settings.matchClipLength === undefined
            ? { matchClipLength: false }
            : {}),
        };

        return {
          ...prev,
          captureSettingsByAnimation: {
            ...prev.captureSettingsByAnimation,
            [animationKey]: next,
          },
        };
      });
    },
    [],
  );

  const resetAnimationCaptureSettings = useCallback((animationKey: string) => {
    setCameraDraft((prev) => {
      if (!prev) return prev;
      const remaining = { ...prev.captureSettingsByAnimation };
      delete remaining[animationKey];

      return {
        ...prev,
        captureSettingsByAnimation: remaining,
      };
    });
  }, []);

  const selectedPreviewCamera = useMemo(() => {
    if (!previewDirection) return undefined;
    return resolveWorkflowCamera({
      direction: previewDirection,
      defaultDistance: cameraDistance,
      defaultCameraAngle: cameraAngle,
      defaultTarget,
      options: cameraDraft ? createRunOptions(cameraDraft) : undefined,
    });
  }, [
    cameraAngle,
    cameraDistance,
    cameraDraft,
    previewDirection,
    defaultTarget,
  ]);
  const workflowDistanceLabel =
    selectedPreviewCamera?.cameraType === "orthographic" ? "Zoom" : "Distance";

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowDefinition) => {
      const workflowSteps = buildWorkflowSteps(workflow, {
        clips: workflowClips,
        hiddenAnimations,
        includeHiddenAnimations: true,
        modelUuids: Object.keys(workflowModels),
      });
      const skippedStepLabels = getHiddenWorkflowStepLabels(
        workflowSteps,
        hiddenAnimations,
      );
      const cameraDraft = createCameraDraft({
        workflow,
        cameraDistance,
        cameraAngle,
        cameraType: mainCameraType ?? "perspective",
        target: defaultTarget,
        captureNormalMaps: exportNormalMap,
        skippedStepLabels,
      });

      setSelectedWorkflow(workflow);
      setSelectedStepLabel(undefined);
      setSelectedAnimationKey(undefined);
      setOriginalCameraSnapshot(createCameraSnapshot(cameraDraft));
      setCameraDraft(cameraDraft);
      resetWorkflow();
      setDialogOpen(true);
    },
    [
      cameraAngle,
      cameraDistance,
      defaultTarget,
      exportNormalMap,
      hiddenAnimations,
      mainCameraType,
      setSelectedWorkflow,
      resetWorkflow,
      setDialogOpen,
      workflowClips,
      workflowModels,
    ],
  );

  const onRun = async () => {
    if (!selectedWorkflow) return;
    await runWorkflow(
      selectedWorkflow,
      cameraDraft ? createRunOptions(cameraDraft) : undefined,
    );
  };

  const onClose = () => {
    if (isRunning) return;
    setDialogOpen(false);
    setSelectedWorkflow(null);
    setSelectedStepLabel(undefined);
    setSelectedAnimationKey(undefined);
    setOriginalCameraSnapshot(null);
    setCameraDraft(null);
  };

  const resetCameraDraft = useCallback(() => {
    if (!originalCameraSnapshot) return;

    setCameraDraft((prev) =>
      prev
        ? {
            ...prev,
            distance: originalCameraSnapshot.distance,
            elevationAngle: originalCameraSnapshot.elevationAngle,
            cameraType: originalCameraSnapshot.cameraType,
            directionRotationOffset:
              originalCameraSnapshot.directionRotationOffset,
            target: cloneTarget(originalCameraSnapshot.target),
            directionOverrides: cloneDirectionOverrides(
              originalCameraSnapshot.directionOverrides,
            ),
          }
        : prev,
    );
  }, [originalCameraSnapshot]);

  const updateSelectedCamera = useCallback(
    (
      values: Partial<{
        distance: number;
        phi: number;
        theta: number;
        target: WorkflowCameraTarget;
      }>,
    ) => {
      if (!selectedDirection) return;
      setCameraDraft((prev) => {
        if (!prev) return prev;

        if (prev.previewAppliesTo === "selected") {
          const current =
            prev.directionOverrides[selectedDirection.label] ?? {};
          return {
            ...prev,
            directionOverrides: {
              ...prev.directionOverrides,
              [selectedDirection.label]: {
                ...current,
                ...(values.distance !== undefined
                  ? { distance: values.distance }
                  : {}),
                ...(values.phi !== undefined ? { phi: values.phi } : {}),
                ...(values.theta !== undefined
                  ? { theta: normalizeWorkflowDegrees(values.theta) }
                  : {}),
                ...(values.target
                  ? { target: cloneTarget(values.target) }
                  : {}),
              },
            },
          };
        }

        return {
          ...prev,
          ...(values.distance !== undefined
            ? { distance: values.distance }
            : {}),
          ...(values.phi !== undefined ? { elevationAngle: values.phi } : {}),
          ...(values.theta !== undefined
            ? {
                directionRotationOffset: normalizeWorkflowDegrees(
                  values.theta - selectedDirection.theta,
                ),
              }
            : {}),
          ...(values.target ? { target: cloneTarget(values.target) } : {}),
        };
      });
    },
    [selectedDirection],
  );

  const applySelectedToAll = useCallback(() => {
    if (!selectedDirection || !selectedPreviewCamera) return;
    setCameraDraft((prev) =>
      prev
        ? {
            ...prev,
            distance: selectedPreviewCamera.distance,
            elevationAngle: selectedPreviewCamera.phi,
            directionRotationOffset: normalizeWorkflowDegrees(
              selectedPreviewCamera.theta - selectedDirection.theta,
            ),
            target: cloneTarget(selectedPreviewCamera.target),
            previewAppliesTo: "all",
          }
        : prev,
    );
  }, [selectedDirection, selectedPreviewCamera]);

  const saveSelectedOverride = useCallback(() => {
    if (!selectedDirection || !selectedPreviewCamera) return;
    setCameraDraft((prev) =>
      prev
        ? {
            ...prev,
            previewAppliesTo: "selected",
            directionOverrides: {
              ...prev.directionOverrides,
              [selectedDirection.label]: {
                distance: selectedPreviewCamera.distance,
                phi: selectedPreviewCamera.phi,
                theta: selectedPreviewCamera.theta,
                target: cloneTarget(selectedPreviewCamera.target),
              },
            },
          }
        : prev,
    );
  }, [selectedDirection, selectedPreviewCamera]);

  const clearSelectedOverride = useCallback(() => {
    if (!selectedDirection) return;
    setCameraDraft((prev) => {
      if (!prev) return prev;
      const remaining = Object.fromEntries(
        Object.entries(prev.directionOverrides).filter(
          ([label]) => label !== selectedDirection.label,
        ),
      );
      return {
        ...prev,
        directionOverrides: remaining,
      };
    });
  }, [selectedDirection]);

  const applyToMainCameraDefaults = useCallback(() => {
    if (!selectedPreviewCamera) return;
    setCameraDistance(selectedPreviewCamera.distance);
    setCameraAngle(selectedPreviewCamera.phi);
    if (cameraUUID) {
      setCameraType(cameraUUID, selectedPreviewCamera.cameraType);
      if (selectedPreviewCamera.cameraType === "orthographic") {
        setCamera(cameraUUID, {
          zoom: selectedPreviewCamera.zoom ?? selectedPreviewCamera.distance,
        });
      }
    }
  }, [
    selectedPreviewCamera,
    cameraUUID,
    setCamera,
    setCameraType,
    setCameraAngle,
    setCameraDistance,
  ]);

  const setPreviewCamera = useCallback(
    (camera: { distance: number; phi: number; theta: number }) => {
      if (!cameraDraft) return;
      updateSelectedCamera(camera);
    },
    [cameraDraft, updateSelectedCamera],
  );

  const setPreviewTarget = useCallback(
    (target: [number, number, number]) => {
      if (!cameraDraft) return;
      updateSelectedCamera({ target });
    },
    [cameraDraft, updateSelectedCamera],
  );

  useEffect(() => {
    const setWorkflow = (workflowId: WorkflowId) => {
      const workflow = WORKFLOW_PRESETS.find((w) => w.id === workflowId);
      if (!workflow) return;
      onSelectWorkflow(workflow);
    };

    PubSub.on(EventType.SET_WORKFLOW, setWorkflow);
    return () => {
      PubSub.off(EventType.SET_WORKFLOW, setWorkflow);
    };
  }, [onSelectWorkflow]);

  useEffect(() => {
    const onStartWorkflow = (payload?: StartWorkflowPayload) => {
      const workflowId =
        typeof payload === "string" ? payload : payload?.workflowId;
      const workflow = workflowId
        ? WORKFLOW_PRESETS.find((w) => w.id === workflowId)
        : selectedWorkflow;
      if (!workflow) return;
      runWorkflow(
        workflow,
        typeof payload === "object" ? payload.options : undefined,
      );
    };

    PubSub.on(EventType.START_WORKFLOW, onStartWorkflow);

    return () => {
      PubSub.off(EventType.START_WORKFLOW, onStartWorkflow);
    };
  }, [selectedWorkflow, runWorkflow]);

  return (
    <>
      <MenubarMenu>
        <MenubarTrigger
          aria-label="Workflows"
          data-testid="workflow-menu-trigger"
        >
          <WorkflowIcon className="w-4 h-4" />
        </MenubarTrigger>
        <MenubarContent className="z-999">
          <MenubarGroup>
            <MenubarItem disabled className="text-muted-foreground text-xs">
              Auto-capture workflows
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            {presets.map((workflow) => (
              <MenubarItem
                key={workflow.id}
                data-testid={`workflow-preset-${workflow.id}`}
                onSelect={() => onSelectWorkflow(workflow)}
                disabled={isRunning}
              >
                {workflow.label}
              </MenubarItem>
            ))}
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true);
            return;
          }
          onClose();
        }}
      >
        <DialogContent
          className="z-999 grid h-[calc(100vh-3rem)] max-h-[1000px] w-[calc(100vw-3rem)] max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[1600px]"
          showCloseButton={!isRunning}
        >
          <DialogHeader className="shrink-0 space-y-0 px-6 pb-4 pt-5 pe-12 text-left">
            <div className="flex flex-wrap items-baseline gap-2">
              <DialogTitle className="flex items-center gap-1.5 text-[13px] font-semibold">
                <WorkflowIcon className="size-3.5" />
                {selectedWorkflow?.label ?? "Workflow"}
              </DialogTitle>
              <DialogDescription className="min-w-0 text-[11px] text-muted-foreground">
                {selectedWorkflow?.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/*
            The shot on the left, what it will be taken of on the right. Both
            are the same size decision the dialog exists to make, so neither is
            tucked into a corner: the preview is the largest thing here, and the
            grid beside it is the plan it belongs to.
          */}
          <div className="grid min-h-0 gap-6 overflow-hidden px-6 pb-3 lg:grid-cols-[minmax(0,1fr)_460px]">
            {selectedPreviewCamera && previewDirection ? (
              <WorkflowStage
                camera={selectedPreviewCamera}
                directionLabel={previewDirection.label}
                previewAppliesTo={cameraDraft?.previewAppliesTo ?? "all"}
                cameraType={cameraDraft?.cameraType ?? "perspective"}
                distanceLabel={workflowDistanceLabel}
                frameAspect={
                  exportWidth > 0 && exportHeight > 0
                    ? exportWidth / exportHeight
                    : 1
                }
                autoFit={Boolean(cameraDraft?.autoFit)}
                fitMargin={cameraDraft?.fitMargin ?? 0}
                onAutoFitChange={(autoFit) =>
                  setCameraDraft((prev) => (prev ? { ...prev, autoFit } : prev))
                }
                onFitMarginChange={(fitMargin) =>
                  setCameraDraft((prev) =>
                    prev ? { ...prev, fitMargin } : prev,
                  )
                }
                isRunning={isRunning}
                canReset={Boolean(originalCameraSnapshot)}
                hasSelectedOverride={Boolean(
                  selectedDirection &&
                    cameraDraft?.directionOverrides[selectedDirection.label],
                )}
                selectedAnimation={{
                  modelUuid: selectedStep?.modelUuid,
                  animationName: selectedStep?.animationName,
                  forceAnimationsInPlace: cameraDraft?.forceAnimationsInPlace,
                  forceAnimationsInPlaceMode:
                    cameraDraft?.forceAnimationsInPlaceMode,
                }}
                onScopeChange={(scope) =>
                  setCameraDraft((prev) =>
                    prev ? { ...prev, previewAppliesTo: scope } : prev,
                  )
                }
                onCameraTypeChange={(cameraType) =>
                  setCameraDraft((prev) =>
                    prev ? { ...prev, cameraType } : prev,
                  )
                }
                onCameraChange={updateSelectedCamera}
                onPreviewCameraChange={setPreviewCamera}
                onPreviewTargetChange={setPreviewTarget}
                onReset={resetCameraDraft}
                onApplyToMainDefaults={applyToMainCameraDefaults}
                onSaveSelected={saveSelectedOverride}
                onApplyToAll={applySelectedToAll}
                onClearOverride={clearSelectedOverride}
              />
            ) : (
              <div className="grid place-items-center text-[11px] text-faint-foreground">
                Load a model to preview this workflow.
              </div>
            )}

            {/* One column, three questions: what, how much, and which part of
                the clip. Hairlines rather than panels — nesting cards inside a
                dialog reads as three dialogs. */}
            <div className="flex min-h-0 flex-col divide-y divide-stroke overflow-y-auto pe-0.5">
              <div className="pb-4">
                <WorkflowMatrix
                  groups={stepGroups}
                  directionLabels={
                    selectedWorkflow?.directions.map((dir) => dir.label) ?? []
                  }
                  skippedStepLabels={cameraDraft?.skippedStepLabels ?? []}
                  hiddenAnimations={hiddenAnimations}
                  framesByAnimation={framesByAnimation}
                  selectedAnimationKey={selectedAnimationKey}
                  selectedDirectionLabel={previewDirection?.label}
                  isRunning={isRunning}
                  capturedStepLabels={capturedStepLabels}
                  runningStepLabel={
                    isRunning ? workflowState.currentLabel : undefined
                  }
                  onSetStepsEnabled={setStepLabelsEnabled}
                  onSelectAnimation={selectWorkflowAnimationGroup}
                  onSelectDirection={(label) => {
                    const directionStep =
                      steps.find(
                        (step) =>
                          step.directionLabel === label &&
                          !cameraDraft?.skippedStepLabels.includes(
                            step.rowLabel,
                          ),
                      ) ??
                      steps.find((step) => step.directionLabel === label);

                    setCameraDraft((prev) =>
                      prev ? { ...prev, selectedDirectionLabel: label } : prev,
                    );
                    if (directionStep) setSelectedStepLabel(directionStep.rowLabel);
                  }}
                />
              </div>

              <div className="py-4">
                <WorkflowCaptureSection
                  isRunning={isRunning}
                  intervalMs={intervals}
                  frameCount={iterations}
                  matchClipLength={Boolean(cameraDraft?.matchClipLength)}
                  onIntervalChange={(value) =>
                    setIntervals(positiveIntegerInput(value, intervals, 5000))
                  }
                  onFrameCountChange={(value) =>
                    setIterations(positiveIntegerInput(value, iterations, 1000))
                  }
                  onMatchClipLengthChange={(matchClipLength) =>
                    setCameraDraft((prev) =>
                      prev ? { ...prev, matchClipLength } : prev,
                    )
                  }
                  captureNormalMaps={Boolean(cameraDraft?.captureNormalMaps)}
                  onCaptureNormalMapsChange={(captureNormalMaps) =>
                    setCameraDraft((prev) =>
                      prev ? { ...prev, captureNormalMaps } : prev,
                    )
                  }
                  showIsolateModels={Object.keys(workflowModels).length > 1}
                  isolateModels={Boolean(cameraDraft?.isolateModels)}
                  onIsolateModelsChange={(isolateModels) =>
                    setCameraDraft((prev) =>
                      prev ? { ...prev, isolateModels } : prev,
                    )
                  }
                  selection={
                    selectedAnimationGroup && shouldShowStepControls
                      ? {
                          animationName: selectedAnimationGroup.animationName,
                          intervalMs: selectedFrameIntervalMs,
                          frameCount: selectedCapturedFrames,
                          clipFrames: selectedClipFrames,
                          matchesClipLength: selectedMatchesClipLength,
                          overruns: selectedCaptureOverruns,
                          hasOverride: hasSelectedCaptureOverride,
                          onIntervalChange: (value) =>
                            updateAnimationCaptureSettings(
                              selectedAnimationGroup.key,
                              {
                                frameIntervalMs: positiveIntegerInput(
                                  value,
                                  selectedFrameIntervalMs,
                                  5000,
                                ),
                              },
                            ),
                          onFrameCountChange: (value) =>
                            updateAnimationCaptureSettings(
                              selectedAnimationGroup.key,
                              {
                                frameCount: positiveIntegerInput(
                                  value,
                                  selectedFrameCount,
                                  1000,
                                ),
                              },
                            ),
                          onMatchClip: () =>
                            updateAnimationCaptureSettings(
                              selectedAnimationGroup.key,
                              { matchClipLength: true },
                            ),
                          onReset: () =>
                            resetAnimationCaptureSettings(
                              selectedAnimationGroup.key,
                            ),
                        }
                      : undefined
                  }
                />
              </div>

              <div className="py-4">
                <WorkflowAnimationSection
                  isRunning={isRunning}
                  forceInPlace={Boolean(cameraDraft?.forceAnimationsInPlace)}
                  onForceInPlaceChange={(forceAnimationsInPlace) =>
                    setCameraDraft((prev) =>
                      prev ? { ...prev, forceAnimationsInPlace } : prev,
                    )
                  }
                  freezeAxes={cameraDraft?.forceAnimationsInPlaceMode ?? "all"}
                  onFreezeAxesChange={(forceAnimationsInPlaceMode) =>
                    setCameraDraft((prev) =>
                      prev ? { ...prev, forceAnimationsInPlaceMode } : prev,
                    )
                  }
                  selection={
                    shouldShowStepControls && selectedStepClip && selectedStep
                      ? {
                          animationName: selectedStep.animationName,
                          startFrame: selectedStepStartFrame,
                          lengthFrames: selectedStepLengthFrames,
                          clipFrames: Math.max(
                            1,
                            Math.round(
                              selectedStepClip.clip.duration * selectedStepFps,
                            ),
                          ),
                          fps: selectedStepFps,
                          loop: selectedStepLoop,
                          onRangeChange: updateStepAnimationRange,
                          onLoopChange: (loop) => {
                            if (
                              !selectedStepModelUuid ||
                              !selectedStepAnimationName ||
                              selectedStepAnimationName === "none"
                            ) {
                              return;
                            }
                            setStepLoop(
                              selectedStepModelUuid,
                              selectedStepAnimationName,
                              loop,
                            );
                          },
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 border-t border-stroke px-6 py-4">
            <WorkflowRunStatus
              state={workflowState}
              plannedSequences={enabledSteps.length}
              plannedFrames={plannedFrames}
            />
            <div className="ml-auto flex shrink-0 justify-end gap-2">
            {isRunning ? (
              <Button variant="destructive" onClick={abortWorkflow}>
                Cancel
              </Button>
            ) : isDone ? (
              <Button onClick={onClose}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  id="run-workflow-button"
                  onClick={onRun}
                  disabled={enabledSteps.length === 0 || !canRunWorkflow}
                >
                  {/* The count is stated directly above; repeating it here
                      made the button the third place the same number appeared. */}
                  {canRunWorkflow ? "Run workflow" : "Load a model first"}
                </Button>
              </>
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
