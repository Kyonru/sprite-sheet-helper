import { computePosition, type WorkflowDirection } from "@/constants/workflows";
import type { CameraType } from "@/types/camera";

export type WorkflowCameraTarget = [number, number, number];

export type WorkflowCameraDirectionOverride = {
  phi?: number;
  theta?: number;
  distance?: number;
  target?: WorkflowCameraTarget;
};

export type WorkflowRunOptions = {
  cameraDistance?: number;
  cameraAngle?: number;
  cameraType?: CameraType;
  directionRotationOffset?: number;
  target?: WorkflowCameraTarget;
  directionOverrides?: Record<string, WorkflowCameraDirectionOverride>;
  forceAnimationsInPlace?: boolean;
  skipStepLabels?: string[];
  includeHiddenAnimations?: boolean;
  captureNormalMaps?: boolean;
};

export type ResolvedWorkflowCamera = {
  phi: number;
  theta: number;
  distance: number;
  zoom?: number;
  cameraType: CameraType;
  target: WorkflowCameraTarget;
  position: WorkflowCameraTarget;
};

export type ResolveWorkflowCameraInput = {
  direction: WorkflowDirection;
  defaultDistance: number;
  defaultCameraAngle?: number;
  defaultCameraType?: CameraType;
  defaultTarget: WorkflowCameraTarget;
  options?: WorkflowRunOptions;
};

export function normalizeWorkflowDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function resolveWorkflowCamera({
  direction,
  defaultDistance,
  defaultCameraAngle,
  defaultCameraType,
  defaultTarget,
  options,
}: ResolveWorkflowCameraInput): ResolvedWorkflowCamera {
  const override = options?.directionOverrides?.[direction.label];
  const rotationOffset = options?.directionRotationOffset ?? 0;
  const distance =
    override?.distance ?? options?.cameraDistance ?? defaultDistance;
  const phi =
    override?.phi ?? options?.cameraAngle ?? defaultCameraAngle ?? direction.phi;
  const theta = normalizeWorkflowDegrees(
    override?.theta ?? direction.theta + rotationOffset,
  );
  const cameraType = options?.cameraType ?? defaultCameraType ?? "perspective";
  const target = [
    ...(override?.target ?? options?.target ?? defaultTarget),
  ] as WorkflowCameraTarget;
  const positionDistance =
    cameraType === "orthographic" ? defaultDistance : distance;

  return {
    phi,
    theta,
    distance,
    ...(cameraType === "orthographic" ? { zoom: distance } : {}),
    cameraType,
    target,
    position: computePosition(phi, theta, positionDistance, target),
  };
}
