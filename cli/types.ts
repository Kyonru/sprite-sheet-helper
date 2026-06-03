export interface CaptureOptions {
  modelUuid: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  cameraDistance?: number;
  cameraAngle?: number;
  directionRotationOffset?: number;
  target?: CliWorkflowCameraTarget;
  directionOverrides?: CliWorkflowDirectionOverrides;
  normalMap?: boolean;
  silent?: boolean;
}

export interface CliAtlasOptions {
  layout?: "rows" | "packed";
  padding?: number;
  extrude?: number;
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
