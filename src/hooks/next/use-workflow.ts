import { useState, useCallback, useEffect, useRef } from "react";
import {
  PubSub,
  EventType,
  type CaptureStopPayload,
  type CaptureProgressPayload,
} from "@/lib/events";
import { useModelsStore } from "@/store/next/models";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import { useCamerasStore } from "@/store/next/cameras";
import { useTargetsStore } from "@/store/next/targets";
import { useTransformsStore } from "@/store/next/transforms";
import {
  WORKFLOW_PRESETS,
  type WorkflowDefinition,
  type WorkflowDirection,
} from "@/constants/workflows";
import { useEntitiesStore } from "@/store/next/entities";
import {
  buildWorkflowSteps,
  getWorkflowStepCaptureSettings,
  type BuildWorkflowStepsInput,
  type WorkflowCaptureSettings,
  type WorkflowStep,
} from "@/utils/workflows";
import {
  getWorkflowCameraTransform,
  resolveWorkflowCamera,
  type ResolvedWorkflowCamera,
  type WorkflowRunOptions,
} from "@/utils/workflow-camera";

export type WorkflowStatus =
  | "idle"
  | "running"
  | "done"
  | "cancelled"
  | "error";

export interface WorkflowState {
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  currentFrame: number;
  expectedFrames: number;
  currentLabel: string;
  currentAnimation: string;
  currentDirection: string;
  startedAt?: number;
  failureStep?: string;
  error?: string;
  currentCamera?: ResolvedWorkflowCamera;
}

const CAPTURE_TIMEOUT_BUFFER_MS = 5000;
const ANIMATION_READY_TIMEOUT_MS = 5000;

const initialState: WorkflowState = {
  status: "idle",
  currentStep: 0,
  totalSteps: 0,
  currentFrame: 0,
  expectedFrames: 0,
  currentLabel: "",
  currentAnimation: "",
  currentDirection: "",
};

const waitForAnimationFrames = (count: number) =>
  new Promise<void>((resolve) => {
    const next = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });

const waitForCaptureDone = ({
  label,
  workflowRunId,
  timeoutMs,
}: {
  label: string;
  workflowRunId: string;
  timeoutMs: number;
}): Promise<CaptureStopPayload> =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      PubSub.off(EventType.STOP_ASSETS_CREATION, handler);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Capture timeout for ${label}`));
    }, timeoutMs);

    const handler = (payload: CaptureStopPayload) => {
      if (payload.label !== label || payload.workflowRunId !== workflowRunId) {
        return;
      }

      cleanup();

      if (payload.status === "error") {
        reject(new Error(`Capture failed for ${label}`));
        return;
      }

      resolve(payload);
    };

    PubSub.on(EventType.STOP_ASSETS_CREATION, handler);
  });

const waitForAnimationReady = (
  uuid: string,
  animation: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      PubSub.off(EventType.ANIMATION_READY, handler);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Animation ready timeout for ${uuid}:${animation}`));
    }, ANIMATION_READY_TIMEOUT_MS);

    const handler = ({
      uuid: readyUuid,
      animation: readyAnimation,
    }: {
      uuid: string;
      animation: string;
    }) => {
      if (uuid !== readyUuid || animation !== readyAnimation) return;
      cleanup();
      resolve();
    };

    PubSub.on(EventType.ANIMATION_READY, handler);
  });

type BuildStepsFromStoreOptions = Pick<
  BuildWorkflowStepsInput,
  "includeHiddenAnimations"
>;

function buildStepsFromStore(
  workflow: WorkflowDefinition,
  options: BuildStepsFromStoreOptions = {},
): WorkflowStep[] {
  const { clips, hiddenAnimations, models } = useModelsStore.getState();
  return buildWorkflowSteps(workflow, {
    clips,
    hiddenAnimations,
    modelUuids: Object.keys(models),
    includeHiddenAnimations: options.includeHiddenAnimations,
  });
}

function getDirectionForStep(
  workflow: WorkflowDefinition,
  step: WorkflowStep,
): WorkflowDirection {
  return (
    workflow.directions.find((dir) => dir.label === step.directionLabel) ??
    workflow.directions[0]
  );
}

function shouldSkipStep(
  step: WorkflowStep,
  options?: WorkflowRunOptions,
): boolean {
  return options?.skipStepLabels?.includes(step.rowLabel) ?? false;
}

async function setStepAnimation(
  step: WorkflowStep,
  options?: WorkflowRunOptions,
) {
  if (step.animationName === "none") return;
  if (!step.modelUuid) return;

  const modelState = useModelsStore.getState();
  if (shouldSkipStep(step, options)) {
    modelState.setAnimation(step.modelUuid, "none");
    return;
  }

  const modelClips = modelState.clips[step.modelUuid] ?? [];
  const clip = modelClips.find((c) => c.clip.name === step.animationName);
  if (!clip) return;

  if (options?.forceAnimationsInPlace) {
    modelState.forceCurrentAnimationInPlace(
      step.modelUuid,
      step.animationName,
      options.forceAnimationsInPlaceMode,
    );
  }

  const currentAnimation = modelState.animations[step.modelUuid];
  const shouldWait = currentAnimation !== step.animationName;
  const waiter = shouldWait
    ? waitForAnimationReady(step.modelUuid, step.animationName)
    : Promise.resolve();

  modelState.setAnimation(step.modelUuid, step.animationName);
  modelState.mixerRef[step.modelUuid]?.setTime(0);

  await waiter;
}

function resetStepAnimation(
  step: WorkflowStep,
  options?: WorkflowRunOptions,
) {
  if (shouldSkipStep(step, options)) {
    return;
  }

  if (!step.modelUuid || step.animationName === "none") return;

  const modelState = useModelsStore.getState();
  const modelClips = modelState.clips[step.modelUuid] ?? [];
  const clip = modelClips.find((c) => c.clip.name === step.animationName);

  const mixer = modelState.mixerRef[step.modelUuid];
  mixer?.setTime(0);
  if (clip) mixer?.clipAction(clip.clip)?.play();
}

export const useWorkflow = () => {
  const [workflowState, setWorkflowState] =
    useState<WorkflowState>(initialState);

  const abortRef = useRef(false);
  const workflowRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onProgress = (payload: CaptureProgressPayload) => {
      if (
        !workflowRunIdRef.current ||
        payload.workflowRunId !== workflowRunIdRef.current
      ) {
        return;
      }

      setWorkflowState((prev) => ({
        ...prev,
        currentFrame: payload.capturedFrames,
        expectedFrames: payload.expectedFrames,
      }));
    };

    PubSub.on(EventType.ASSETS_CREATION_PROGRESS, onProgress);
    return () => {
      PubSub.off(EventType.ASSETS_CREATION_PROGRESS, onProgress);
    };
  }, []);

  const buildSteps = useCallback(
    (
      workflow: WorkflowDefinition,
      options?: BuildStepsFromStoreOptions,
    ): WorkflowStep[] => buildStepsFromStore(workflow, options),
    [],
  );

  const runWorkflow = useCallback(async (
    workflow: WorkflowDefinition,
    options?: WorkflowRunOptions,
  ) => {
    useEntitiesStore.getState().unselectEntity();
    abortRef.current = false;
    const previousExportNormalMap = useSettingsStore.getState().exportNormalMap;
    const captureNormalMaps = options?.captureNormalMaps;
    const shouldRestoreExportNormalMap =
      captureNormalMaps !== undefined && captureNormalMaps !== previousExportNormalMap;
    if (shouldRestoreExportNormalMap) {
      useSettingsStore.getState().setExportNormalMap(captureNormalMaps);
    }

    const steps = buildStepsFromStore(workflow, {
      includeHiddenAnimations: options?.includeHiddenAnimations,
    }).filter((step) => !shouldSkipStep(step, options));
    const workflowRunId = Date.now().toString();
    workflowRunIdRef.current = workflowRunId;

    const cameraDistance = useSettingsStore.getState().cameraDistance;
    const cameraAngle = useSettingsStore.getState().cameraAngle;
    const defaultCaptureSettings: WorkflowCaptureSettings = {
      frameIntervalMs: useImagesStore.getState().intervals,
      frameCount: useImagesStore.getState().iterations,
    };
    const cameraUUID = useCamerasStore.getState().mainCamera;
    const mainCameraType = cameraUUID
      ? useCamerasStore.getState().cameras[cameraUUID]?.type
      : undefined;
    const workflowCameraType = options?.cameraType ?? mainCameraType ?? "perspective";
    if (cameraUUID) {
      useCamerasStore.getState().setCameraType(cameraUUID, workflowCameraType);
    }
    const target: [number, number, number] = cameraUUID
      ? (useTargetsStore.getState().targets[cameraUUID] ?? [0, 0, 0])
      : [0, 0, 0];

    setWorkflowState({
      status: "running",
      currentStep: 0,
      totalSteps: steps.length,
      currentFrame: 0,
      expectedFrames: defaultCaptureSettings.frameCount,
      currentLabel: "",
      currentAnimation: "",
      currentDirection: "",
      startedAt: Date.now(),
    });

    try {
      for (let index = 0; index < steps.length; index++) {
        if (abortRef.current) break;

        const step = steps[index];
        const dir = getDirectionForStep(workflow, step);
        const captureSettings = getWorkflowStepCaptureSettings(
          step,
          options?.captureSettingsByAnimation,
          defaultCaptureSettings,
        );

        setWorkflowState((prev) => ({
          ...prev,
          currentStep: index + 1,
          currentFrame: 0,
          expectedFrames: captureSettings.frameCount,
          currentLabel: step.rowLabel,
          currentAnimation: step.animationName,
          currentDirection: step.directionLabel,
        }));

        await setStepAnimation(step, options);
        resetStepAnimation(step, options);

        const camera = resolveWorkflowCamera({
          direction: dir,
          defaultDistance: cameraDistance,
          defaultCameraAngle: cameraAngle,
          defaultCameraType: workflowCameraType,
          defaultTarget: target,
          options,
        });

        setWorkflowState((prev) => ({
          ...prev,
          currentCamera: camera,
        }));

        if (cameraUUID) {
          useTransformsStore
            .getState()
            .setTransform(cameraUUID, getWorkflowCameraTransform(camera));
          useTargetsStore.getState().setTarget(cameraUUID, [...camera.target]);

          if (camera.cameraType === "orthographic") {
            useCamerasStore.getState().setCamera(cameraUUID, {
              zoom: camera.zoom ?? camera.distance,
            });
          }
        }

        PubSub.emit(EventType.SET_CAMERA_ANGLE, {
          position: camera.position,
          target: camera.target,
        });
        await waitForAnimationFrames(2);

        const captureDone = waitForCaptureDone({
          label: step.rowLabel,
          workflowRunId,
          timeoutMs:
            captureSettings.frameIntervalMs * captureSettings.frameCount +
            CAPTURE_TIMEOUT_BUFFER_MS,
        });

        PubSub.emit(EventType.START_ASSETS_CREATION, {
          label: step.rowLabel,
          workflowRunId,
          stepIndex: index + 1,
          totalSteps: steps.length,
          frameIntervalMs: captureSettings.frameIntervalMs,
          frameCount: captureSettings.frameCount,
          rowMetadata: {
            workflow: {
              workflowId: workflow.id,
              workflowLabel: workflow.label,
              ...(step.modelUuid ? { modelUuid: step.modelUuid } : {}),
              animationName: step.animationName,
              directionLabel: step.directionLabel,
            },
          },
        });

        const result = await captureDone;

        setWorkflowState((prev) => ({
          ...prev,
          currentFrame: result.capturedFrames,
          expectedFrames: result.expectedFrames,
        }));

        if (result.status === "cancelled") {
          abortRef.current = true;
          break;
        }
      }

      const status = abortRef.current ? "cancelled" : "done";
      setWorkflowState((prev) => ({ ...prev, status }));

      PubSub.emit(EventType.STOP_WORKFLOW, {
        workflow,
        workflowRunId,
        status,
      });
    } catch (err) {
      setWorkflowState((prev) => ({
        ...prev,
        status: "error",
        failureStep: prev.currentLabel,
        error: (err as Error).message,
      }));
      PubSub.emit(EventType.STOP_WORKFLOW, {
        workflow,
        workflowRunId,
        status: "error",
        error: (err as Error).message,
      });
    } finally {
      if (shouldRestoreExportNormalMap) {
        useSettingsStore.getState().setExportNormalMap(previousExportNormalMap);
      }
      workflowRunIdRef.current = null;
    }
  }, []);

  const abortWorkflow = useCallback(() => {
    abortRef.current = true;
    PubSub.emit(EventType.CANCEL_ASSETS_CREATION, {
      workflowRunId: workflowRunIdRef.current,
    });
    setWorkflowState((prev) => ({ ...prev, status: "cancelled" }));
  }, []);

  const resetWorkflow = useCallback(() => {
    setWorkflowState(initialState);
  }, []);

  const canRunWorkflow = useModelsStore((state) =>
    Object.values(state.models).some((model) => model.loadState === "loaded"),
  );

  return {
    workflowState,
    runWorkflow,
    abortWorkflow,
    buildSteps,
    resetWorkflow,
    presets: WORKFLOW_PRESETS,
    canRunWorkflow,
  };
};
