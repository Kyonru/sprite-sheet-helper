export type MaterialMapKind =
  | "albedo"
  | "normal"
  | "roughness"
  | "metalness"
  | "ao"
  | "emissive";

export type MaterialLightingMode = "pbr" | "unlit" | "flat";

export type MaterialSide = "front" | "back" | "double";

export type MaterialPresetId =
  | "standard-pbr"
  | "unlit-sprite"
  | "low-poly-flat"
  | "ps1-character"
  | "retro-horror"
  | "toon";

export type MaterialTextureAsset = {
  uuid: string;
  name: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  sourceTextureId?: string;
  createdAt: number;
  generated?: boolean;
  generation?: RetroTextureOptions;
};

export type RetroTextureOptions = {
  targetSize: number;
  paletteColors: number;
  dither: boolean;
  nearest: boolean;
};

export type MaterialTextureRefs = Partial<Record<MaterialMapKind, string>>;

export type MaterialAsset = {
  uuid: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  presetId?: MaterialPresetId;
  color: string;
  opacity: number;
  transparent: boolean;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  wireframe: boolean;
  side: MaterialSide;
  depthWrite: boolean;
  flatShading: boolean;
  lightingMode: MaterialLightingMode;
  textureRefs: MaterialTextureRefs;
  nearestFiltering: boolean;
  textureSize: number;
  paletteColors: number;
  dithering: boolean;
};

export type MaterialAssignment = {
  id: string;
  modelUuid: string;
  meshPath: string;
  meshName: string;
  materialSlot: number;
  materialId: string;
  updatedAt: number;
};

export type MaterialOriginalSnapshot = {
  name: string;
  color: string;
  opacity: number;
  transparent: boolean;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  wireframe?: boolean;
  side: MaterialSide;
  depthWrite: boolean;
  flatShading: boolean;
  hasTextures: Partial<Record<MaterialMapKind, boolean>>;
};

export type MaterialInventoryItem = {
  id: string;
  modelUuid?: string;
  meshPath: string;
  meshName: string;
  materialSlot: number;
  originalMaterialName: string;
  original: MaterialOriginalSnapshot;
};

export type MaterialsSnapshot = {
  materials: Record<string, MaterialAsset>;
  assignments: Record<string, MaterialAssignment>;
  textures: Record<string, MaterialTextureAsset>;
  selectedMaterialId?: string;
  selectedAssignmentId?: string;
};

export type MaterialComponent = MaterialAsset;
