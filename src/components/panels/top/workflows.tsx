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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  CameraIcon,
  CircleCheckIcon,
  CrosshairIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  TrashIcon,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { EventType, PubSub } from "@/lib/events";
import { WorkflowCameraPreview } from "@/components/workflows/workflow-camera-preview";
import * as THREE from "three";
import {
  normalizeWorkflowDegrees,
  resolveWorkflowCamera,
  type WorkflowCameraTarget,
  type WorkflowRunOptions,
} from "@/utils/workflow-camera";
import { getAnimationClipFps } from "@/utils/animation-clips";
import { useCamerasStore } from "@/store/next/cameras";
import { useTarget } from "@/store/next/targets";
import { useModelsStore, type LoopType } from "@/store/next/models";
import { cn } from "@/lib/utils";
import type { CameraType } from "@/types/camera";

const WORKFLOW_LOOP_OPTIONS = {
  "Loop Once": THREE.LoopOnce,
  "Loop Repeat": THREE.LoopRepeat,
  "Ping Pong": THREE.LoopPingPong,
} satisfies Record<string, LoopType>;

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
  skippedStepLabels: string[];
  captureNormalMaps: boolean;
};

type StartWorkflowPayload =
  | WorkflowId
  | {
      workflowId?: WorkflowId;
      options?: WorkflowRunOptions;
    };

function cloneTarget(target: WorkflowCameraTarget): WorkflowCameraTarget {
  return [target[0], target[1], target[2]];
}

function createCameraDraft({
  workflow,
  cameraDistance,
  cameraAngle,
  cameraType,
  target,
  captureNormalMaps,
}: {
  workflow: WorkflowDefinition;
  cameraDistance: number;
  cameraAngle?: number;
  cameraType: CameraType;
  target: WorkflowCameraTarget;
  captureNormalMaps: boolean;
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
    skippedStepLabels: [],
    captureNormalMaps,
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
    skipStepLabels: draft.skippedStepLabels,
    captureNormalMaps: draft.captureNormalMaps,
  };
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
  const [animationSettingsExpanded, setAnimationSettingsExpanded] =
    useState(true);

  const {
    workflowState,
    runWorkflow,
    abortWorkflow,
    buildSteps,
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
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const mainCameraType = useCamerasStore(
    (state) => state.cameras[cameraUUID || ""]?.type,
  );
  const setCameraType = useCamerasStore((state) => state.setCameraType);
  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const setIterations = useImagesStore((state) => state.setIterations);
  const storedTarget = useTarget(cameraUUID);
  const defaultTarget = useMemo<WorkflowCameraTarget>(() => {
    const target: WorkflowCameraTarget = storedTarget ?? [0, 0, 0];
    return cloneTarget(target);
  }, [storedTarget]);

  const steps = selectedWorkflow ? buildSteps(selectedWorkflow) : [];
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
  const isCancelled = workflowState.status === "cancelled";
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
  const availableStepLabels = useMemo(
    () =>
      steps
        .map((step) => step.rowLabel)
        .filter((label): label is string => Boolean(label)),
    [steps],
  );
  const selectedStep = useMemo(
    () => steps.find((step) => step.rowLabel === selectedStepLabel) ?? steps[0],
    [selectedStepLabel, steps],
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
      return;
    }

    setSelectedStepLabel((current) => {
      if (current && steps.some((step) => step.rowLabel === current)) {
        return current;
      }

      return steps[0].rowLabel;
    });
  }, [steps]);

  const shouldShowStepControls = Boolean(
    selectedStep &&
    selectedStep.modelUuid &&
    selectedStepAnimationName &&
    selectedStepAnimationName !== "none" &&
    selectedStepClip,
  );

  const setAllStepsEnabled = useCallback(
    (enabled: boolean) => {
      setCameraDraft((prev) =>
        prev
          ? {
              ...prev,
              skippedStepLabels: enabled
                ? []
                : Array.from(new Set(availableStepLabels)),
            }
          : prev,
      );
    },
    [availableStepLabels],
  );

  const disableAllSteps = useCallback(() => {
    setAllStepsEnabled(false);
  }, [setAllStepsEnabled]);

  const enableAllSteps = useCallback(() => {
    setAllStepsEnabled(true);
  }, [setAllStepsEnabled]);

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

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowDefinition) => {
      setSelectedWorkflow(workflow);
      setSelectedStepLabel(undefined);
      setCameraDraft(
        createCameraDraft({
          workflow,
          cameraDistance,
          cameraAngle,
          cameraType: mainCameraType ?? "perspective",
          target: defaultTarget,
          captureNormalMaps: exportNormalMap,
        }),
      );
      resetWorkflow();
      setDialogOpen(true);
    },
    [
      cameraAngle,
      cameraDistance,
      defaultTarget,
      exportNormalMap,
      mainCameraType,
      setSelectedWorkflow,
      resetWorkflow,
      setDialogOpen,
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
    setCameraDraft(null);
  };

  const resetDraft = useCallback(() => {
    if (!selectedWorkflow) return;
    setCameraDraft(
      createCameraDraft({
        workflow: selectedWorkflow,
        cameraDistance,
        cameraAngle,
        cameraType: mainCameraType ?? "perspective",
        target: defaultTarget,
        captureNormalMaps: exportNormalMap,
      }),
    );
  }, [
    cameraAngle,
    cameraDistance,
    defaultTarget,
    mainCameraType,
    selectedWorkflow,
    exportNormalMap,
  ]);

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
    }
  }, [
    selectedPreviewCamera,
    cameraUUID,
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
          className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 w-[90vw] sm:max-w-[90vw] z-999"
          showCloseButton={!isRunning}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 px-6 pt-6">
              <WorkflowIcon className="size-5" />
              {selectedWorkflow?.label ?? "Workflow"}
            </DialogTitle>
            <DialogDescription className="px-6">
              {selectedWorkflow?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-hidden px-6 lg:grid-cols-[minmax(0,1fr)_620px]">
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Will generate {enabledSteps.length} sequence
                  {enabledSteps.length !== 1 ? "s" : ""}
                </p>
                <div className="text-xs text-muted-foreground">
                  {cameraDraft?.previewAppliesTo === "selected"
                    ? "Editing selected direction"
                    : "Editing all directions"}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {selectedWorkflow?.directions.map((dir) => {
                  const hasOverride = Boolean(
                    cameraDraft?.directionOverrides[dir.label],
                  );
                  const isSelected =
                    cameraDraft?.selectedDirectionLabel === dir.label;
                  return (
                    <Button
                      key={dir.label}
                      type="button"
                      data-testid={`workflow-direction-${dir.label}`}
                      variant={isSelected ? "default" : "outline"}
                      size="xs"
                      disabled={isRunning}
                      onClick={() => {
                        setCameraDraft((prev) =>
                          prev
                            ? { ...prev, selectedDirectionLabel: dir.label }
                            : prev,
                        );
                        setSelectedStepLabel(
                          steps.find(
                            (step) => step.directionLabel === dir.label,
                          )?.rowLabel,
                        );
                      }}
                      className={cn(
                        hasOverride && !isSelected && "border-primary/60",
                      )}
                    >
                      {dir.label}
                      {hasOverride && <span className="text-[10px]">•</span>}
                    </Button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isRunning || availableStepLabels.length === 0}
                  onClick={enableAllSteps}
                >
                  Enable all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isRunning || availableStepLabels.length === 0}
                  onClick={disableAllSteps}
                >
                  Ignore all
                </Button>
              </div>

              {selectedPreviewCamera && previewDirection && (
                <div className="grid gap-3 rounded-md border p-3">
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 text-sm font-medium"
                    onClick={() =>
                      setAnimationSettingsExpanded((expanded) => !expanded)
                    }
                  >
                    <span>Animation settings</span>
                    {animationSettingsExpanded ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                  </button>

                  {animationSettingsExpanded && (
                    <div className="grid gap-3">
                      {shouldShowStepControls ? (
                        <>
                          <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-foreground">
                                {selectedStep?.animationName}
                              </span>
                            </span>
                            <span className="shrink-0">
                              Angle: {previewDirection?.label}
                            </span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="grid gap-1">
                              <Label
                                htmlFor="workflow-animation-start-frame"
                                className="text-xs text-muted-foreground"
                              >
                                Start frame
                              </Label>
                              <Input
                                id="workflow-animation-start-frame"
                                type="number"
                                min={0}
                                step={1}
                                value={selectedStepStartFrame}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  if (Number.isFinite(value)) {
                                    updateStepAnimationRange(
                                      value,
                                      selectedStepLengthFrames,
                                    );
                                  }
                                }}
                                disabled={isRunning || !shouldShowStepControls}
                                className="h-8"
                              />
                            </div>

                            <div className="grid gap-1">
                              <Label
                                htmlFor="workflow-animation-duration-frames"
                                className="text-xs text-muted-foreground"
                              >
                                Duration
                              </Label>
                              <Input
                                id="workflow-animation-duration-frames"
                                type="number"
                                min={1}
                                step={1}
                                value={selectedStepLengthFrames}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  if (Number.isFinite(value)) {
                                    updateStepAnimationRange(
                                      selectedStepStartFrame,
                                      value,
                                    );
                                  }
                                }}
                                disabled={isRunning || !shouldShowStepControls}
                                className="h-8"
                              />
                            </div>

                            <div className="grid gap-1">
                              <Label
                                htmlFor="workflow-animation-loop"
                                className="text-xs text-muted-foreground"
                              >
                                Looping
                              </Label>
                              <select
                                id="workflow-animation-loop"
                                value={selectedStepLoop}
                                onChange={(event) => {
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
                                    Number(event.target.value) as LoopType,
                                  );
                                }}
                                disabled={isRunning || !shouldShowStepControls}
                                className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                              >
                                {Object.entries(WORKFLOW_LOOP_OPTIONS).map(
                                  ([label, value]) => (
                                    <option key={label} value={value}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Select an animation step to configure duration and
                          looping.
                        </p>
                      )}

                      <label className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                          Force animations in place
                        </span>
                        <Switch
                          checked={cameraDraft?.forceAnimationsInPlace}
                          onCheckedChange={(checked) =>
                            setCameraDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    forceAnimationsInPlace: Boolean(checked),
                                  }
                                : prev,
                            )
                          }
                          disabled={isRunning}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
                <div className="flex flex-col gap-1">
                  {steps.map((step) => {
                    const stepRunIndex = enabledStepOrder.get(step.rowLabel);
                    const isCurrentStep =
                      isRunning && step.rowLabel === workflowState.currentLabel;
                    const isPast = isRunning
                      ? Boolean(
                          stepRunIndex &&
                            stepRunIndex < workflowState.currentStep,
                        )
                      : isDone && Boolean(stepRunIndex);
                    const isSelectedDirection =
                      step.directionLabel ===
                      cameraDraft?.selectedDirectionLabel;
                    const isStepEnabled = step.rowLabel
                      ? !cameraDraft?.skippedStepLabels.includes(step.rowLabel)
                      : true;
                    const isSelectedStep = step.rowLabel === selectedStepLabel;

                    return (
                      <div
                        key={step.rowLabel}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
                          !isStepEnabled && "text-muted-foreground opacity-60",
                          isCurrentStep &&
                            "border border-primary/30 bg-primary/10",
                          isPast && "opacity-40",
                          isSelectedStep &&
                            "ring-1 ring-primary/40 bg-primary/10",
                          isSelectedDirection && !isCurrentStep && "bg-muted",
                        )}
                      >
                        <Checkbox
                          checked={isStepEnabled}
                          onCheckedChange={(checked) =>
                            setCameraDraft((prev) => {
                              if (!prev || !step.rowLabel) return prev;
                              const isChecked = Boolean(checked);
                              return {
                                ...prev,
                                skippedStepLabels: isChecked
                                  ? prev.skippedStepLabels.filter(
                                      (label) => label !== step.rowLabel,
                                    )
                                  : [
                                      ...new Set([
                                        ...prev.skippedStepLabels,
                                        step.rowLabel,
                                      ]),
                                    ],
                              };
                            })
                          }
                          onClick={(event) => event.stopPropagation()}
                          disabled={isRunning}
                        />
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            setSelectedStepLabel(step.rowLabel);
                            setCameraDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    selectedDirectionLabel: step.directionLabel,
                                  }
                                : prev,
                            );
                          }}
                          className="min-w-0 flex-1 truncate text-left"
                        >
                          <span className="min-w-0 truncate font-mono">
                            {step.rowLabel}
                          </span>
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {step.animationName} · {step.directionLabel}
                        </span>
                        {isPast && (
                          <CircleCheckIcon className="size-3 shrink-0 text-green-500" />
                        )}
                        {isCurrentStep && (
                          <LoaderCircleIcon className="size-3 shrink-0 animate-spin" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {isRunning && (
                <div className="flex flex-col gap-1 rounded-md border bg-muted/20 p-3">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Capturing: {workflowState.currentLabel}</span>
                    <span>
                      {workflowState.currentStep} / {workflowState.totalSteps}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {workflowState.currentAnimation || "none"} ·{" "}
                      {workflowState.currentDirection || "direction"}
                    </span>
                    <span>
                      Frames {workflowState.currentFrame} /{" "}
                      {workflowState.expectedFrames}
                      {workflowState.startedAt
                        ? ` · ${Math.max(
                            0,
                            Math.round(
                              (Date.now() - workflowState.startedAt) / 1000,
                            ),
                          )}s`
                        : ""}
                    </span>
                  </div>
                  {workflowState.currentCamera && (
                    <div className="text-xs text-muted-foreground">
                      Camera {workflowState.currentCamera.cameraType} · φ{" "}
                      {workflowState.currentCamera.phi.toFixed(1)}° · θ{" "}
                      {workflowState.currentCamera.theta.toFixed(1)}° · d{" "}
                      {workflowState.currentCamera.distance.toFixed(2)}
                    </div>
                  )}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${
                          workflowState.totalSteps > 0
                            ? (workflowState.currentStep /
                                workflowState.totalSteps) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {isDone && (
                <p className="flex items-center gap-1 text-sm text-green-500">
                  <CircleCheckIcon className="size-4" />
                  All sequences captured successfully.
                </p>
              )}

              {isCancelled && (
                <p className="text-sm text-muted-foreground">
                  Workflow cancelled.
                </p>
              )}

              {workflowState.status === "error" && (
                <p className="text-sm text-destructive">
                  Error
                  {workflowState.failureStep
                    ? ` at ${workflowState.failureStep}`
                    : ""}
                  : {workflowState.error}
                </p>
              )}
            </div>

            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-1">
              {selectedPreviewCamera && previewDirection && (
                <>
                  <WorkflowCameraPreview
                    camera={selectedPreviewCamera}
                    selectedDirection={previewDirection.label}
                    selectedAnimation={{
                      modelUuid: selectedStep?.modelUuid,
                      animationName: selectedStep?.animationName,
                      forceAnimationsInPlace:
                        cameraDraft?.forceAnimationsInPlace,
                    }}
                    onCameraChange={setPreviewCamera}
                    onTargetChange={setPreviewTarget}
                  />

                  <div className="grid gap-3 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CameraIcon className="size-4" />
                        Camera Draft
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Projection
                        </span>
                        <div className="flex rounded-md border p-0.5">
                          <Button
                            type="button"
                            size="xs"
                            variant={
                              cameraDraft?.cameraType === "perspective"
                                ? "default"
                                : "outline"
                            }
                            disabled={isRunning}
                            data-testid="workflow-camera-projection-perspective"
                            onClick={() =>
                              setCameraDraft((prev) =>
                                prev
                                  ? { ...prev, cameraType: "perspective" }
                                  : prev,
                              )
                            }
                          >
                            Perspective
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant={
                              cameraDraft?.cameraType === "orthographic"
                                ? "default"
                                : "outline"
                            }
                            disabled={isRunning}
                            data-testid="workflow-camera-projection-orthographic"
                            onClick={() =>
                              setCameraDraft((prev) =>
                                prev
                                  ? { ...prev, cameraType: "orthographic" }
                                  : prev,
                              )
                            }
                          >
                            Orthographic
                          </Button>
                        </div>
                        <div className="flex rounded-md border p-0.5">
                          <Button
                            type="button"
                            size="xs"
                            data-testid="workflow-camera-apply-all-mode"
                            variant={
                              cameraDraft?.previewAppliesTo === "all"
                                ? "default"
                                : "ghost"
                            }
                            disabled={isRunning}
                            onClick={() =>
                              setCameraDraft((prev) =>
                                prev
                                  ? { ...prev, previewAppliesTo: "all" }
                                  : prev,
                              )
                            }
                          >
                            All
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            data-testid="workflow-camera-apply-selected-mode"
                            variant={
                              cameraDraft?.previewAppliesTo === "selected"
                                ? "default"
                                : "ghost"
                            }
                            disabled={isRunning}
                            onClick={() =>
                              setCameraDraft((prev) =>
                                prev
                                  ? { ...prev, previewAppliesTo: "selected" }
                                  : prev,
                              )
                            }
                          >
                            Selected
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border px-3 py-2">
                      <label className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Capture normal maps
                        </span>
                        <Switch
                          checked={cameraDraft?.captureNormalMaps}
                          onCheckedChange={(checked) =>
                            setCameraDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    captureNormalMaps: Boolean(checked),
                                  }
                                : prev,
                            )
                          }
                          disabled={isRunning}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border px-3 py-2">
                        <Label
                          htmlFor="workflow-capture-intervals"
                          className="mb-2 block text-xs text-muted-foreground"
                        >
                          Frame interval (ms)
                        </Label>
                        <Input
                          id="workflow-capture-intervals"
                          type="number"
                          min={1}
                          max={5000}
                          step={1}
                          value={intervals}
                          disabled={isRunning}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (Number.isFinite(value)) {
                              setIntervals(Math.max(1, Math.round(value)));
                            }
                          }}
                          className="h-8"
                        />
                      </div>
                      <div className="rounded-md border px-3 py-2">
                        <Label
                          htmlFor="workflow-capture-iterations"
                          className="mb-2 block text-xs text-muted-foreground"
                        >
                          Frames captured
                        </Label>
                        <Input
                          id="workflow-capture-iterations"
                          type="number"
                          min={1}
                          max={1000}
                          step={1}
                          value={iterations}
                          disabled={isRunning}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (Number.isFinite(value)) {
                              setIterations(Math.max(1, Math.round(value)));
                            }
                          }}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="workflow-camera-distance">
                            Distance
                          </Label>
                          <Input
                            id="workflow-camera-distance"
                            data-testid="workflow-camera-distance-input"
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={selectedPreviewCamera.distance}
                            disabled={isRunning}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value)) {
                                updateSelectedCamera({ distance: value });
                              }
                            }}
                            className="h-8 w-24"
                          />
                        </div>
                        <Slider
                          data-testid="workflow-camera-distance-slider"
                          value={[selectedPreviewCamera.distance]}
                          min={0.5}
                          max={20}
                          step={0.1}
                          disabled={isRunning}
                          onValueChange={([value]) =>
                            updateSelectedCamera({ distance: value })
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="workflow-camera-elevation">
                            Elevation
                          </Label>
                          <Input
                            id="workflow-camera-elevation"
                            data-testid="workflow-camera-elevation-input"
                            type="number"
                            min={1}
                            max={179}
                            step={1}
                            value={selectedPreviewCamera.phi}
                            disabled={isRunning}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value)) {
                                updateSelectedCamera({
                                  phi: Math.min(179, Math.max(1, value)),
                                });
                              }
                            }}
                            className="h-8 w-24"
                          />
                        </div>
                        <Slider
                          data-testid="workflow-camera-elevation-slider"
                          value={[selectedPreviewCamera.phi]}
                          min={1}
                          max={179}
                          step={1}
                          disabled={isRunning}
                          onValueChange={([value]) =>
                            updateSelectedCamera({ phi: value })
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="workflow-camera-theta">
                            Direction Rotation
                          </Label>
                          <Input
                            id="workflow-camera-theta"
                            data-testid="workflow-camera-theta-input"
                            type="number"
                            min={0}
                            max={359}
                            step={1}
                            value={selectedPreviewCamera.theta}
                            disabled={isRunning}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value)) {
                                updateSelectedCamera({ theta: value });
                              }
                            }}
                            className="h-8 w-24"
                          />
                        </div>
                        <Slider
                          data-testid="workflow-camera-theta-slider"
                          value={[selectedPreviewCamera.theta]}
                          min={0}
                          max={359}
                          step={1}
                          disabled={isRunning}
                          onValueChange={([value]) =>
                            updateSelectedCamera({ theta: value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-muted/50 p-2">
                        Target X
                        <div className="font-mono">
                          {selectedPreviewCamera.target[0].toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        Target Y
                        <div className="font-mono">
                          {selectedPreviewCamera.target[1].toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        Target Z
                        <div className="font-mono">
                          {selectedPreviewCamera.target[2].toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="workflow-camera-reset-button"
                        disabled={isRunning}
                        onClick={resetDraft}
                      >
                        <RotateCcwIcon className="size-4" />
                        Reset
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="workflow-camera-main-defaults-button"
                        disabled={isRunning}
                        onClick={applyToMainCameraDefaults}
                      >
                        <CameraIcon className="size-4" />
                        Main Defaults
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="workflow-camera-save-selected-button"
                        disabled={isRunning}
                        onClick={saveSelectedOverride}
                      >
                        <CrosshairIcon className="size-4" />
                        Save Selected
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="workflow-camera-apply-selected-to-all-button"
                        disabled={isRunning}
                        onClick={applySelectedToAll}
                      >
                        Apply to All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          isRunning ||
                          (selectedDirection &&
                            !cameraDraft?.directionOverrides[
                              selectedDirection.label
                            ])
                        }
                        onClick={clearSelectedOverride}
                        className="col-span-2"
                      >
                        <TrashIcon className="size-4" />
                        Clear selected override
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-4">
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
                  {canRunWorkflow
                    ? `Run Workflow (${enabledSteps.length} sequences)`
                    : "Load a model first"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
