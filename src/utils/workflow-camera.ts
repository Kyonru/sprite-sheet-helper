import { computePosition, type WorkflowDirection } from "@/constants/workflows";

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
  directionRotationOffset?: number;
  target?: WorkflowCameraTarget;
  directionOverrides?: Record<string, WorkflowCameraDirectionOverride>;
};

export type ResolvedWorkflowCamera = {
  phi: number;
  theta: number;
  distance: number;
  target: WorkflowCameraTarget;
  position: WorkflowCameraTarget;
};

export type ResolveWorkflowCameraInput = {
  direction: WorkflowDirection;
  defaultDistance: number;
  defaultCameraAngle?: number;
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
  defaultTarget,
  options,
}: ResolveWorkflowCameraInput): ResolvedWorkflowCamera {
  const override = options?.directionOverrides?.[direction.label];
  const rotationOffset = options?.directionRotationOffset ?? 0;
  const distance =
    override?.distance ?? options?.cameraDistance ?? defaultDistance;
  const phi = override?.phi ?? options?.cameraAngle ?? defaultCameraAngle ?? direction.phi;
  const theta = normalizeWorkflowDegrees(
    override?.theta ?? direction.theta + rotationOffset,
  );
  const target = [
    ...(override?.target ?? options?.target ?? defaultTarget),
  ] as WorkflowCameraTarget;

  return {
    phi,
    theta,
    distance,
    target,
    position: computePosition(phi, theta, distance, target),
  };
}
