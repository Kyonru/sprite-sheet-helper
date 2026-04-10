type CanvasLayer = 0 | 1;

export const LAYERS: Record<
  "LAYER_DEFAULT" | "LAYER_EDITOR_ONLY",
  CanvasLayer
> = {
  LAYER_DEFAULT: 0,
  LAYER_EDITOR_ONLY: 1,
};
