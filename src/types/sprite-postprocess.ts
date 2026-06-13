export type SpritePostprocessEffectType =
  | "outerOutline"
  | "dropShadow"
  | "glow"
  | "colorAdjust";

export type SpritePostprocessEffectBase = {
  id: string;
  type: SpritePostprocessEffectType;
  enabled: boolean;
};

export type OuterOutlineEffect = SpritePostprocessEffectBase & {
  type: "outerOutline";
  color: string;
  thickness: number;
  opacity: number;
  outlineMode?: "smooth" | "crisp";
};

export type DropShadowEffect = SpritePostprocessEffectBase & {
  type: "dropShadow";
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  opacity: number;
};

export type GlowEffect = SpritePostprocessEffectBase & {
  type: "glow";
  color: string;
  radius: number;
  opacity: number;
};

export type ColorAdjustEffect = SpritePostprocessEffectBase & {
  type: "colorAdjust";
  brightness: number;
  contrast: number;
  saturation: number;
};

export type SpritePostprocessEffect =
  | OuterOutlineEffect
  | DropShadowEffect
  | GlowEffect
  | ColorAdjustEffect;

export type SpritePostprocessSnapshot = {
  enabled: boolean;
  effects: SpritePostprocessEffect[];
  selectedRow: number;
  selectedFrame: number;
  compareBeforeAfter: boolean;
};
