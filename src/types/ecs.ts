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

export interface MaterialComponent {
  color: string;
  opacity: number;
  roughness: number;
  metalness: number;
  wireframe: boolean;
}

export interface ModelComponent {
  filePath: string;
  fileName: string;
}

// The full serializable snapshot
export interface ProjectSnapshot {
  version: number;
  name: string;
  savedAt: number;
  entities: Record<string, Entity>;
  children: Record<string, Record<string, boolean>>;
  transforms: Record<string, Transform>;
  materials: Record<string, MaterialComponent>;
  models: Record<string, ModelComponent>;
}

export interface MaterialComponent {
  // base
  color: string;
  opacity: number;
  transparent: boolean;

  // pbr
  roughness: number;
  metalness: number;

  // maps (file paths or data URLs)
  map: string | null; // diffuse/albedo
  normalMap: string | null;
  roughnessMap: string | null;
  metalnessMap: string | null;
  aoMap: string | null;
  emissiveMap: string | null;

  // emissive
  emissive: string;
  emissiveIntensity: number;

  // other
  wireframe: boolean;
  side: "front" | "back" | "double";
  depthWrite: boolean;
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

// --- EFFECTS (post-processing) ---

export interface BloomEffect {
  type: "bloom";
  enabled: boolean;
  intensity: number;
  threshold: number;
  smoothing: number;
  mipmapBlur: boolean;
}

export interface ChromaticAberrationEffect {
  type: "chromatic-aberration";
  enabled: boolean;
  offset: [number, number];
}

export interface VignetteEffect {
  type: "vignette";
  enabled: boolean;
  offset: number;
  darkness: number;
}

export interface DepthOfFieldEffect {
  type: "depth-of-field";
  enabled: boolean;
  focusDistance: number;
  focalLength: number;
  bokehScale: number;
}

export interface SSAOEffect {
  type: "ssao";
  enabled: boolean;
  intensity: number;
  radius: number;
  bias: number;
}

export interface ToneMappingEffect {
  type: "tone-mapping";
  enabled: boolean;
  mode: "linear" | "reinhard" | "cineon" | "aces-filmic";
  exposure: number;
}

export interface NoiseEffect {
  type: "noise";
  enabled: boolean;
  opacity: number;
  premultiply: boolean;
}

export type EffectComponent =
  | BloomEffect
  | ChromaticAberrationEffect
  | VignetteEffect
  | DepthOfFieldEffect
  | SSAOEffect
  | ToneMappingEffect
  | NoiseEffect;

export type EffectType = EffectComponent["type"];
