export type ModelDowngradePresetId =
  | "ps1-character"
  | "low-poly-clean"
  | "pixel-art-3d"
  | "retro-horror";

export type ModelDowngradeVariant = "original" | "downgraded";

export type ModelDowngradeRecipe = {
  presetId: ModelDowngradePresetId;
  triangleBudget: number;
  textureSize: number;
  paletteColors: number;
  flatShading: boolean;
  snapVertices: number;
  animationFps: number;
  steppedAnimation: boolean;
  nearestFiltering: boolean;
  simplifyMaterials: boolean;
  mergeVertices: boolean;
  removeTinyIslands: boolean;
  ditherTextures: boolean;
};

export type ModelDowngradeAnalysis = {
  triangleCount: number;
  meshCount: number;
  staticMeshCount: number;
  skinnedMeshCount: number;
  morphTargetMeshCount: number;
  materialCount: number;
  textureCount: number;
  maxTextureSize: number;
  textureSizes: { name: string; width: number; height: number }[];
  boneCount: number;
  animationCount: number;
  animationKeyframeCount: number;
  eligibleStaticMeshCount: number;
  topologySkippedMeshCount: number;
};

export type ModelDowngradeReport = {
  before: ModelDowngradeAnalysis;
  after: ModelDowngradeAnalysis;
  warnings: string[];
  operations: string[];
};

export type ModelDowngradeEntry = {
  recipe: ModelDowngradeRecipe;
  activeVariant: ModelDowngradeVariant;
  analysis?: ModelDowngradeAnalysis;
  report?: ModelDowngradeReport;
  status: "idle" | "analyzing" | "previewing" | "ready" | "error";
  errorMessage?: string;
  revision: number;
};

export type ModelDowngradesState = {
  entries: Record<string, ModelDowngradeEntry>;
  selectedPresetId: ModelDowngradePresetId;
};

export type ModelDowngradePreset = {
  id: ModelDowngradePresetId;
  name: string;
  description: string;
  recipe: ModelDowngradeRecipe;
};
