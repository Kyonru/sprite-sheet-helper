export interface CaptureOptions {
  modelUuid: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  cameraDistance?: number;
  normalMap?: boolean;
}

export interface CliAtlasOptions {
  layout?: "rows" | "packed";
  padding?: number;
  extrude?: number;
  scale?: number;
  maxAtlasSize?: number;
  allowMultiPage?: boolean;
}
