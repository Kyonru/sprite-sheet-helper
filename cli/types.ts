export interface CaptureOptions {
  modelUuid: string;
  frames: number;
  /** Workflow runs only: derive each sequence's frame count from its clip. */
  matchClipLength?: boolean;
  fps: number;
  width: number;
  height: number;
  cameraDistance?: number;
  cameraAngle?: number;
  directionRotationOffset?: number;
  target?: CliWorkflowCameraTarget;
  directionOverrides?: CliWorkflowDirectionOverrides;
  normalMap?: boolean;
  captureNormalMaps?: boolean;
  forceAnimationsInPlace?: boolean;
  skipStepLabels?: string[];
  includeAnimations?: string[];
  sheets?: { all?: string; byAnimation?: Record<string, string> };
  captureSettings?: CliCaptureSettingsByAnimation;
  isolateModels?: boolean;
  fit?: CliFitOptions;
  silent?: boolean;
}

export type CliFitMode = "auto" | "manual";
export type CliFitScope = "all" | "animation" | "direction";
export type CliFitMarginUnit = "px" | "percent";

export type CliFitOptions = {
  mode: CliFitMode;
  margin: number;
  marginUnit: CliFitMarginUnit;
  scope: CliFitScope;
  samples: number;
};

export interface CliAtlasOptions {
  layout?: "rows" | "packed";
  padding?: number;
  extrude?: number;
  spriteMargin?: number;
  scale?: number;
  maxAtlasSize?: number;
  allowMultiPage?: boolean;
}

export type CliWorkflowCameraTarget = [number, number, number];

export type CliWorkflowDirectionOverride = {
  phi?: number;
  theta?: number;
  distance?: number;
  target?: CliWorkflowCameraTarget;
};

export type CliWorkflowDirectionOverrides = Record<
  string,
  CliWorkflowDirectionOverride
>;

export type CliCaptureSettings = {
  frameCount?: number;
  frameIntervalMs?: number;
  matchClipLength?: boolean;
};

export type CliCaptureSettingsByAnimation = Record<string, CliCaptureSettings>;
