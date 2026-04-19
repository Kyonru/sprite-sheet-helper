import { useState, useCallback, useRef } from "react";
import { PubSub, EventType } from "@/lib/events";
import { useModelsStore } from "@/store/next/models";
import { useSettingsStore } from "@/store/next/settings";
import { useCamerasStore } from "@/store/next/cameras";
import { useTargetsStore } from "@/store/next/targets";
import {
  WORKFLOW_PRESETS,
  computePosition,
  type WorkflowDefinition,
} from "@/constants/workflows";

export interface WorkflowStep {
  animationName: string;
  directionLabel: string;
  rowLabel: string;
}

export type WorkflowStatus = "idle" | "running" | "done" | "error";

export interface WorkflowState {
  status: WorkflowStatus;
  currentStep: number;
  totalSteps: number;
  currentLabel: string;
  error?: string;
}

const waitForCaptureDone = (label: string): Promise<void> =>
  new Promise((resolve) => {
    const handler = (payload: { label: string }) => {
      if (payload.label === label) resolve();
    };
    PubSub.once(EventType.STOP_ASSETS_CREATION, handler);
  });

const waitForAnimationReady = (
  uuid: string,
  animation: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      PubSub.off(EventType.ANIMATION_READY, handler);
      console.warn(
        `[ANIMATION_READY TIMEOUT] uuid: ${uuid}, animation: ${animation}`,
      );
      reject(
        new Error(
          `Animation ready timeout for ${uuid}:${animation}. Check if model/animation exists.`,
        ),
      );
    }, 5000);

    const handler = ({
      uuid: uuid2,
      animation: animation2,
    }: {
      uuid: string;
      animation: string;
    }) => {
      if (uuid === uuid2 && animation === animation2) {
        clearTimeout(timeout);
        PubSub.off(EventType.ANIMATION_READY, handler);
        resolve();
      }
    };
    PubSub.once(EventType.ANIMATION_READY, handler);
  });

const initialState: WorkflowState = {
  status: "idle",
  currentStep: 0,
  totalSteps: 0,
  currentLabel: "",
};

export const useWorkflow = () => {
  const [workflowState, setWorkflowState] =
    useState<WorkflowState>(initialState);

  const abortRef = useRef(false);

  const buildSteps = useCallback(
    (workflow: WorkflowDefinition): WorkflowStep[] => {
      const clips = useModelsStore.getState().clips;
      const allClips = Object.values(clips).flat();
      const rawNames = allClips.map((c) => c.clip.name);
      const animNames = rawNames.length > 0 ? [...new Set(rawNames)] : ["none"];

      const steps: WorkflowStep[] = [];
      for (const animName of animNames) {
        for (const dir of workflow.directions) {
          steps.push({
            animationName: animName,
            directionLabel: dir.label,
            rowLabel: `${animName}_${dir.label}`,
          });
        }
      }
      return steps;
    },
    [],
  );

  const runWorkflow = useCallback(async (workflow: WorkflowDefinition) => {
    abortRef.current = false;

    const clips = useModelsStore.getState().clips;
    const cameraDistance = useSettingsStore.getState().cameraDistance;
    const cameraUUID = useCamerasStore.getState().mainCamera;
    const target: [number, number, number] = cameraUUID
      ? (useTargetsStore.getState().targets[cameraUUID] ?? [0, 0, 0])
      : [0, 0, 0];

    const allModelUUIDs = Object.keys(clips);
    const allClips = Object.values(clips).flat();
    const rawNames = allClips.map((c) => c.clip.name);
    const animNames = rawNames.length > 0 ? [...new Set(rawNames)] : ["none"];

    const totalSteps = animNames.length * workflow.directions.length;
    let currentStep = 0;

    setWorkflowState({
      status: "running",
      currentStep: 0,
      totalSteps,
      currentLabel: "",
    });

    try {
      for (const animName of animNames) {
        if (abortRef.current) break;

        // Skip waiting for "none" animation since model returns early without emitting event
        const waiters =
          animName === "none"
            ? []
            : allModelUUIDs.map((uuid) =>
                waitForAnimationReady(uuid, animName),
              );

        for (const uuid of allModelUUIDs) {
          const modelClips = clips[uuid] ?? [];
          const clip = modelClips.find((c) => c.clip.name === animName);
          if (clip || animName === "none") {
            useModelsStore.getState().setAnimation(uuid, animName);
            console.log("[DEBUG]: Setting animation", animName, clip);
            useModelsStore
              .getState()
              .setDuration(uuid, animName, [0, clip?.clip.duration ?? 0]);
            console.log("[DEBUG]: Setting duration", animName, clip);
            useModelsStore.getState().mixerRef[uuid]?.setTime(0);
          }
        }

        console.log("[DEBUG]: Setting animations");

        await Promise.all(waiters);
        console.log("[DEBUG]: Animations set");

        for (const dir of workflow.directions) {
          if (abortRef.current) break;

          currentStep += 1;
          const rowLabel = `${animName}_${dir.label}`;

          setWorkflowState((prev) => ({
            ...prev,
            currentStep,
            currentLabel: rowLabel,
          }));
          console.log("[DEBUG]: animation", animName, dir.label);

          for (const uuid of allModelUUIDs) {
            useModelsStore.getState().mixerRef[uuid]?.setTime(0);

            const modelClips = clips[uuid] ?? [];
            const clip = modelClips.find((c) => c.clip.name === animName);

            if (clip) {
              useModelsStore
                .getState()
                .mixerRef[uuid]?.clipAction(clip!.clip!)
                ?.play();
            }
            console.log("[DEBUG]: clip", clip);
          }

          const position = computePosition(
            dir.phi,
            dir.theta,
            cameraDistance,
            target,
          );

          PubSub.emit(EventType.SET_CAMERA_ANGLE, { position, target });

          console.log("[DEBUG]: Setting camera angle", position);
          PubSub.emit(EventType.START_ASSETS_CREATION, { label: rowLabel });
          console.log("[DEBUG]: Starting assets creation");
          await waitForCaptureDone(rowLabel);
          console.log("[DEBUG]: Assets creation done");
        }
      }

      setWorkflowState((prev) => ({
        ...prev,
        status: abortRef.current ? "idle" : "done",
      }));

      PubSub.emit(EventType.STOP_WORKFLOW, {
        workflow,
        status: abortRef.current ? "cancelled" : "done",
      });
    } catch (err) {
      setWorkflowState((prev) => ({
        ...prev,
        status: "error",
        error: (err as Error).message,
      }));
      PubSub.emit(EventType.STOP_WORKFLOW, { workflow, status: "error" });
    }
  }, []);

  const abortWorkflow = useCallback(() => {
    abortRef.current = true;
    setWorkflowState((prev) => ({ ...prev, status: "idle" }));
  }, []);

  const resetWorkflow = useCallback(() => {
    setWorkflowState(initialState);
  }, []);

  return {
    workflowState,
    runWorkflow,
    abortWorkflow,
    buildSteps,
    resetWorkflow,
    presets: WORKFLOW_PRESETS,
  };
};
