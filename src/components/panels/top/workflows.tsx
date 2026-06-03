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
import {
  CameraIcon,
  CircleCheckIcon,
  CrosshairIcon,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { EventType, PubSub } from "@/lib/events";
import { WorkflowCameraPreview } from "@/components/workflows/workflow-camera-preview";
import {
  normalizeWorkflowDegrees,
  resolveWorkflowCamera,
  type WorkflowCameraTarget,
  type WorkflowRunOptions,
} from "@/utils/workflow-camera";
import { useCamerasStore } from "@/store/next/cameras";
import { useTarget } from "@/store/next/targets";
import { cn } from "@/lib/utils";

type PreviewAppliesTo = "all" | "selected";

type WorkflowCameraDraft = {
  distance: number;
  elevationAngle: number;
  directionRotationOffset: number;
  target: WorkflowCameraTarget;
  selectedDirectionLabel: string;
  previewAppliesTo: PreviewAppliesTo;
  directionOverrides: NonNullable<WorkflowRunOptions["directionOverrides"]>;
};

function cloneTarget(target: WorkflowCameraTarget): WorkflowCameraTarget {
  return [target[0], target[1], target[2]];
}

function createCameraDraft({
  workflow,
  cameraDistance,
  cameraAngle,
  target,
}: {
  workflow: WorkflowDefinition;
  cameraDistance: number;
  cameraAngle?: number;
  target: WorkflowCameraTarget;
}): WorkflowCameraDraft {
  const firstDirection = workflow.directions[0];
  return {
    distance: cameraDistance,
    elevationAngle: cameraAngle ?? firstDirection?.phi ?? 45,
    directionRotationOffset: 0,
    target: cloneTarget(target),
    selectedDirectionLabel: firstDirection?.label ?? "",
    previewAppliesTo: "all",
    directionOverrides: {},
  };
}

function createRunOptions(draft: WorkflowCameraDraft): WorkflowRunOptions {
  return {
    cameraDistance: draft.distance,
    cameraAngle: draft.elevationAngle,
    directionRotationOffset: draft.directionRotationOffset,
    target: cloneTarget(draft.target),
    directionOverrides: draft.directionOverrides,
  };
}

export const WorkflowsMenu = () => {
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cameraDraft, setCameraDraft] = useState<WorkflowCameraDraft | null>(
    null,
  );

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
  const setCameraDistance = useSettingsStore((state) => state.setCameraDistance);
  const setCameraAngle = useSettingsStore((state) => state.setCameraAngle);
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const storedTarget = useTarget(cameraUUID);
  const defaultTarget = useMemo<WorkflowCameraTarget>(
    () => {
      const target: WorkflowCameraTarget = storedTarget ?? [0, 0, 0];
      return cloneTarget(target);
    },
    [storedTarget],
  );

  const steps = selectedWorkflow ? buildSteps(selectedWorkflow) : [];
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
  const selectedPreviewCamera = useMemo(() => {
    if (!selectedDirection || !cameraDraft) return undefined;
    return resolveWorkflowCamera({
      direction: selectedDirection,
      defaultDistance: cameraDistance,
      defaultCameraAngle: cameraAngle,
      defaultTarget,
      options: createRunOptions(cameraDraft),
    });
  }, [
    cameraAngle,
    cameraDistance,
    cameraDraft,
    defaultTarget,
    selectedDirection,
  ]);

  const onSelectWorkflow = useCallback(
    (workflow: WorkflowDefinition) => {
      setSelectedWorkflow(workflow);
      setCameraDraft(
        createCameraDraft({
          workflow,
          cameraDistance,
          cameraAngle,
          target: defaultTarget,
        }),
      );
      resetWorkflow();
      setDialogOpen(true);
    },
    [
      cameraAngle,
      cameraDistance,
      defaultTarget,
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
    setCameraDraft(null);
  };

  const resetDraft = useCallback(() => {
    if (!selectedWorkflow) return;
    setCameraDraft(
      createCameraDraft({
        workflow: selectedWorkflow,
        cameraDistance,
        cameraAngle,
        target: defaultTarget,
      }),
    );
  }, [cameraAngle, cameraDistance, defaultTarget, selectedWorkflow]);

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
          const current = prev.directionOverrides[selectedDirection.label] ?? {};
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
                ...(values.target ? { target: cloneTarget(values.target) } : {}),
              },
            },
          };
        }

        return {
          ...prev,
          ...(values.distance !== undefined ? { distance: values.distance } : {}),
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
  }, [selectedPreviewCamera, setCameraAngle, setCameraDistance]);

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
    const onStartWorkflow = (workflowId?: WorkflowId) => {
      const workflow = workflowId
        ? WORKFLOW_PRESETS.find((w) => w.id === workflowId)
        : selectedWorkflow;
      if (!workflow) return;
      runWorkflow(workflow);
    };

    PubSub.on(EventType.START_WORKFLOW, onStartWorkflow);

    return () => {
      PubSub.off(EventType.START_WORKFLOW, onStartWorkflow);
    };
  }, [selectedWorkflow, runWorkflow]);

  return (
    <>
      <MenubarMenu>
        <MenubarTrigger>
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
          className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-[1120px]"
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

          <div className="grid min-h-0 gap-4 overflow-hidden px-6 lg:grid-cols-[minmax(0,1fr)_430px]">
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Will generate {steps.length} sequence
                  {steps.length !== 1 ? "s" : ""}
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
                      variant={isSelected ? "default" : "outline"}
                      size="xs"
                      disabled={isRunning}
                      onClick={() =>
                        setCameraDraft((prev) =>
                          prev
                            ? { ...prev, selectedDirectionLabel: dir.label }
                            : prev,
                        )
                      }
                      className={cn(hasOverride && !isSelected && "border-primary/60")}
                    >
                      {dir.label}
                      {hasOverride && <span className="text-[10px]">•</span>}
                    </Button>
                  );
                })}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
                <div className="flex flex-col gap-1">
                  {steps.map((step, i) => {
                    const isCurrentStep =
                      isRunning && i + 1 === workflowState.currentStep;
                    const isPast = isRunning
                      ? i + 1 < workflowState.currentStep
                      : isDone;
                    const isSelectedDirection =
                      step.directionLabel === cameraDraft?.selectedDirectionLabel;

                    return (
                      <button
                        key={step.rowLabel}
                        type="button"
                        disabled={isRunning}
                        onClick={() =>
                          setCameraDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  selectedDirectionLabel: step.directionLabel,
                                }
                              : prev,
                          )
                        }
                        className={cn(
                          "flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
                          isCurrentStep && "border border-primary/30 bg-primary/10",
                          isPast && "opacity-40",
                          isSelectedDirection && !isCurrentStep && "bg-muted",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">
                          {step.rowLabel}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {step.animationName} · {step.directionLabel}
                        </span>
                        {isPast && (
                          <CircleCheckIcon className="size-3 shrink-0 text-green-500" />
                        )}
                        {isCurrentStep && (
                          <LoaderCircleIcon className="size-3 shrink-0 animate-spin" />
                        )}
                      </button>
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
                      Camera φ {workflowState.currentCamera.phi.toFixed(1)}° · θ{" "}
                      {workflowState.currentCamera.theta.toFixed(1)}° · d{" "}
                      {workflowState.currentCamera.distance.toFixed(2)}
                    </div>
                  )}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{
                        width: `${(workflowState.currentStep / workflowState.totalSteps) * 100}%`,
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
              {selectedPreviewCamera && selectedDirection && cameraDraft && (
                <>
                  <WorkflowCameraPreview
                    camera={selectedPreviewCamera}
                    selectedDirection={selectedDirection.label}
                    onCameraChange={(camera) => {
                      updateSelectedCamera({
                        distance: camera.distance,
                        phi: camera.phi,
                        theta: camera.theta,
                      });
                    }}
                    onTargetChange={(target) =>
                      updateSelectedCamera({ target })
                    }
                  />

                  <div className="grid gap-3 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CameraIcon className="size-4" />
                        Camera Draft
                      </div>
                      <div className="flex rounded-md border p-0.5">
                        <Button
                          type="button"
                          size="xs"
                          variant={
                            cameraDraft.previewAppliesTo === "all"
                              ? "default"
                              : "ghost"
                          }
                          disabled={isRunning}
                          onClick={() =>
                            setCameraDraft((prev) =>
                              prev ? { ...prev, previewAppliesTo: "all" } : prev,
                            )
                          }
                        >
                          All
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant={
                            cameraDraft.previewAppliesTo === "selected"
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

                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="workflow-camera-distance">
                            Distance
                          </Label>
                          <Input
                            id="workflow-camera-distance"
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
                          !cameraDraft.directionOverrides[
                            selectedDirection.label
                          ]
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
                  disabled={steps.length === 0 || !canRunWorkflow}
                >
                  {canRunWorkflow
                    ? `Run Workflow (${steps.length} sequences)`
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
