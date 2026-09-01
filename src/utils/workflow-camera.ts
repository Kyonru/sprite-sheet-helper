import { computePosition, type WorkflowDirection } from "@/constants/workflows";
import type { CameraType } from "@/types/camera";
import type { WorkflowCaptureSettingsByAnimation } from "./workflows";
import type { InPlaceAxisModeInput } from "./animation-clips";
import type { FitOptionsInput } from "./fit-solve";
import * as THREE from "three";

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
  forceAnimationsInPlaceMode?: InPlaceAxisModeInput;
  skipStepLabels?: string[];
  /** Capture only these clips, by name. Everything else is skipped. */
  includeAnimations?: string[];
  /**
   * Hide every other model while a step captures.
   *
   * A workflow expands over all loaded models, but a step only animates its
   * own — so in a scene with two characters, every sequence of one also
   * contains the other, standing there. Off by default, because a scene
   * assembled from several models (a character and the weapon it holds) is
   * a composition, and hiding half of it would be wrong.
   */
  isolateModels?: boolean;
  includeHiddenAnimations?: boolean;
  captureNormalMaps?: boolean;
  captureSettingsByAnimation?: WorkflowCaptureSettingsByAnimation;
  /**
   * Take every animation's frame count from its own clip length, unless that
   * animation sets its own. The CLI's `--frames auto` maps to this.
   */
  matchClipLength?: boolean;
  /** Auto-framing. Defaults to manual, so existing runs keep their framing. */
  fit?: FitOptionsInput;
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

export type WorkflowCameraTransform = {
  position: WorkflowCameraTarget;
  rotation: WorkflowCameraTarget;
  scale: WorkflowCameraTarget;
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

export function getWorkflowCameraTransform(
  camera: Pick<ResolvedWorkflowCamera, "position" | "target">,
): WorkflowCameraTransform {
  const position = new THREE.Vector3(...camera.position);
  const target = new THREE.Vector3(...camera.target);
  const matrix = new THREE.Matrix4().lookAt(
    position,
    target,
    new THREE.Vector3(0, 1, 0),
  );
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
  const rotation = new THREE.Euler().setFromQuaternion(quaternion);

  return {
    position: [...camera.position],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [1, 1, 1],
  };
}
