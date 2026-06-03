import type { MaterialComponent, MaterialsSnapshot } from "./materials";

export type ObjectType = "transform" | "model" | "camera" | "light" | "effect";

export interface Entity {
  uuid: string;
  type: ObjectType;
  name: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface ModelComponent {
  file: File;
  filePath: string;
  fileName: string;
  type: string;
  fileSize: number;
  format: "gltf" | "glb" | "fbx" | "obj" | "stl";
  loadState: "idle" | "loading" | "loaded" | "error";
  errorMessage: string | null;
}

// The full serializable snapshot
export interface ProjectSnapshot {
  version: number;
  name: string;
  savedAt: number;
  entities: Record<string, Entity>;
  children: Record<string, Record<string, boolean>>;
  transforms: Record<string, Transform>;
  materials: MaterialsSnapshot;
  models: Record<string, ModelComponent>;
}

export type ModelLoadState = "idle" | "loading" | "loaded" | "error";

export interface ModelComponent {
  // file info
  fileName: string;
  filePath: string; // local path or object URL
  fileSize: number;
  format: "gltf" | "glb" | "fbx" | "obj" | "stl";

  // runtime (not serialized)
  loadState: ModelLoadState;
  errorMessage: string | null;
}

export type CameraType = "perspective" | "orthographic";

interface CameraBase {
  type: CameraType;
}

export interface PerspectiveCameraComponent extends CameraBase {
  fov: number;
  near: number;
  far: number;
}

export interface OrthographicCameraComponent extends CameraBase {
  zoom: number;
  near: number;
  far: number;
}

export type CameraComponent =
  | PerspectiveCameraComponent
  | OrthographicCameraComponent;

// --- LIGHT ---

export type LightType =
  | "ambient"
  | "directional"
  | "point"
  | "spot"
  | "hemisphere";

export interface AmbientLightComponent {
  type: "ambient";
  color: string;
  intensity: number;
}

export interface DirectionalLightComponent {
  type: "directional";
  color: string;
  intensity: number;
  castShadow: boolean;
  shadowMapSize: 512 | 1024 | 2048 | 4096;
  shadowBias: number;
}

export interface PointLightComponent {
  type: "point";
  color: string;
  intensity: number;
  distance: number; // 0 = infinite
  decay: number;
  castShadow: boolean;
  power: number;
}

export interface SpotLightComponent {
  type: "spot";
  color: string;
  intensity: number;
  distance: number;
  angle: number; // radians, max Math.PI/2
  penumbra: number; // 0-1
  decay: number;
  castShadow: boolean;
  power: number;
}

export interface HemisphereLightComponent {
  type: "hemisphere";
  skyColor: string;
  groundColor: string;
  intensity: number;
}

export type LightComponent =
  | AmbientLightComponent
  | DirectionalLightComponent
  | PointLightComponent
  | SpotLightComponent
  | HemisphereLightComponent;

export type SnapshotEnabledStore<T> = {
  getSnapshot: () => T;
  hydrate: (snapshot: T) => void;
  reset: () => void;
};

export type { MaterialComponent };
