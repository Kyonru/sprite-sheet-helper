import type * as THREE from "three";

export type AuthoredVector3 = [number, number, number];

export type AuthoredPrimitiveKind =
  | "box"
  | "cube"
  | "circle"
  | "plane"
  | "cylinder"
  | "cone"
  | "sphere"
  | "capsule"
  | "dodecahedron"
  | "edges"
  | "extrude"
  | "icosahedron"
  | "lathe"
  | "octahedron"
  | "polyhedron"
  | "ring"
  | "shape"
  | "tetrahedron"
  | "torus"
  | "torusKnot"
  | "tube"
  | "wireframe";

export type AuthoredAxisExtrudeFace = "px" | "nx" | "py" | "ny" | "pz" | "nz";

export type AuthoredGeometryExtrudeFace = {
  kind: "geometry";
  primitive: AuthoredPrimitiveKind;
  sourceId?: string;
  space?: "primitive" | "part";
  index: number;
  label: string;
  center: AuthoredVector3;
  normal: AuthoredVector3;
  triangles: [AuthoredVector3, AuthoredVector3, AuthoredVector3][];
};

export type AuthoredExtrudeFace =
  | AuthoredAxisExtrudeFace
  | AuthoredGeometryExtrudeFace;

export type AuthoredSelectionKind = "bone" | "part";

export type AuthoredExtrudeStep = {
  uuid: string;
  face: AuthoredExtrudeFace;
  distance: number;
  position?: AuthoredVector3;
  rotation?: AuthoredVector3;
  scale: [number, number];
};

export type AuthoredFaceEdit = {
  uuid: string;
  faceKey: string;
  position: AuthoredVector3;
  rotation: AuthoredVector3;
  scale: [number, number];
};

export type AuthoredBone = {
  uuid: string;
  name: string;
  parentId?: string;
  position: AuthoredVector3;
  rotation: AuthoredVector3;
  length: number;
};

export type AuthoredPart = {
  uuid: string;
  name: string;
  boneId: string;
  primitive: AuthoredPrimitiveKind;
  position: AuthoredVector3;
  rotation: AuthoredVector3;
  scale: AuthoredVector3;
  swatchId: string;
  color: string;
  visible: boolean;
  extrusions: AuthoredExtrudeStep[];
  faceEdits?: AuthoredFaceEdit[];
  deletedFaceKeys?: string[];
};

export type AuthoredMaterialSwatch = {
  uuid: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  flatShading: boolean;
};

export type AuthoredMirrorPair = {
  kind: AuthoredSelectionKind;
  leftId: string;
  rightId: string;
};

export type AuthoredModelRecipe = {
  uuid: string;
  name: string;
  kind?: "skeleton" | "primitive";
  bones: Record<string, AuthoredBone>;
  boneOrder: string[];
  parts: Record<string, AuthoredPart>;
  partOrder: string[];
  swatches: Record<string, AuthoredMaterialSwatch>;
  swatchOrder: string[];
  mirrorPairs: AuthoredMirrorPair[];
  selectedBoneId?: string;
  selectedPartId?: string;
  createdAt: number;
  updatedAt: number;
};

export type AuthoredModelsState = {
  recipes: Record<string, AuthoredModelRecipe>;
  selectedRecipeId?: string;
};

export type CreateDefaultHumanoidOptions = {
  uuid?: string;
  name?: string;
  now?: number;
};

export type CreatePrimitiveAssetOptions = {
  uuid?: string;
  name?: string;
  primitive?: AuthoredPrimitiveKind;
  now?: number;
};

export type BuildAuthoredModelOptions = {
  includeSkeleton?: boolean;
  selectedBoneId?: string;
};

export type BuiltAuthoredModel = {
  object: THREE.Group;
  boneObjects: Record<string, THREE.Group>;
  partObjects: Record<string, THREE.Group>;
};

export type AuthoredPose = Record<
  string,
  Partial<Pick<AuthoredBone, "position" | "rotation">>
>;

export type AuthoredMirrorSelection = {
  kind: AuthoredSelectionKind;
  id: string;
};

export type AuthoredExtrudeOptions = {
  uuid?: string;
  distance: number;
  scale?: [number, number];
};
