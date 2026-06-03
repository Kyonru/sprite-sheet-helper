import type {
  AuthoredBone,
  AuthoredExtrudeFace,
  AuthoredExtrudeOptions,
  AuthoredMaterialSwatch,
  AuthoredMirrorSelection,
  AuthoredModelRecipe,
  AuthoredPart,
  AuthoredPose,
  AuthoredPrimitiveKind,
  BuildAuthoredModelOptions,
  BuiltAuthoredModel,
  CreateDefaultHumanoidOptions,
  CreatePrimitiveAssetOptions,
} from "@/types/authored-models";
import { generateUUID } from "@/utils/strings";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

export const AUTHORED_WORLD_BONE_ID = "__world";

const DEFAULT_SWATCHES: AuthoredMaterialSwatch[] = [
  {
    uuid: "swatch-skin",
    name: "Warm clay",
    color: "#c8895a",
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
  },
  {
    uuid: "swatch-cloth",
    name: "Deep cloth",
    color: "#405f8f",
    roughness: 0.8,
    metalness: 0,
    flatShading: true,
  },
  {
    uuid: "swatch-leather",
    name: "Leather",
    color: "#4f3426",
    roughness: 0.85,
    metalness: 0,
    flatShading: true,
  },
  {
    uuid: "swatch-metal",
    name: "Muted metal",
    color: "#85817a",
    roughness: 0.45,
    metalness: 0.35,
    flatShading: true,
  },
];

type BoneInput = Omit<AuthoredBone, "rotation" | "length"> &
  Partial<Pick<AuthoredBone, "rotation" | "length">>;

const BONE_INPUTS: BoneInput[] = [
  { uuid: "root", name: "Root", position: [0, 0, 0], length: 0.2 },
  {
    uuid: "hips",
    name: "Hips",
    parentId: "root",
    position: [0, 0.85, 0],
    length: 0.28,
  },
  {
    uuid: "spine",
    name: "Spine",
    parentId: "hips",
    position: [0, 0.32, 0],
    length: 0.36,
  },
  {
    uuid: "chest",
    name: "Chest",
    parentId: "spine",
    position: [0, 0.36, 0],
    length: 0.32,
  },
  {
    uuid: "neck",
    name: "Neck",
    parentId: "chest",
    position: [0, 0.28, 0],
    length: 0.18,
  },
  {
    uuid: "head",
    name: "Head",
    parentId: "neck",
    position: [0, 0.22, 0],
    length: 0.24,
  },
  {
    uuid: "upper-arm-l",
    name: "Left upper arm",
    parentId: "chest",
    position: [-0.34, 0.16, 0],
    length: 0.44,
  },
  {
    uuid: "lower-arm-l",
    name: "Left lower arm",
    parentId: "upper-arm-l",
    position: [-0.42, -0.05, 0],
    length: 0.42,
  },
  {
    uuid: "hand-l",
    name: "Left hand",
    parentId: "lower-arm-l",
    position: [-0.36, -0.03, 0],
    length: 0.16,
  },
  {
    uuid: "upper-arm-r",
    name: "Right upper arm",
    parentId: "chest",
    position: [0.34, 0.16, 0],
    length: 0.44,
  },
  {
    uuid: "lower-arm-r",
    name: "Right lower arm",
    parentId: "upper-arm-r",
    position: [0.42, -0.05, 0],
    length: 0.42,
  },
  {
    uuid: "hand-r",
    name: "Right hand",
    parentId: "lower-arm-r",
    position: [0.36, -0.03, 0],
    length: 0.16,
  },
  {
    uuid: "upper-leg-l",
    name: "Left upper leg",
    parentId: "hips",
    position: [-0.17, -0.34, 0],
    length: 0.5,
  },
  {
    uuid: "lower-leg-l",
    name: "Left lower leg",
    parentId: "upper-leg-l",
    position: [0, -0.48, 0],
    length: 0.48,
  },
  {
    uuid: "foot-l",
    name: "Left foot",
    parentId: "lower-leg-l",
    position: [0, -0.42, 0.08],
    length: 0.22,
  },
  {
    uuid: "upper-leg-r",
    name: "Right upper leg",
    parentId: "hips",
    position: [0.17, -0.34, 0],
    length: 0.5,
  },
  {
    uuid: "lower-leg-r",
    name: "Right lower leg",
    parentId: "upper-leg-r",
    position: [0, -0.48, 0],
    length: 0.48,
  },
  {
    uuid: "foot-r",
    name: "Right foot",
    parentId: "lower-leg-r",
    position: [0, -0.42, 0.08],
    length: 0.22,
  },
];

const MIRROR_PAIRS = [
  ["upper-arm-l", "upper-arm-r"],
  ["lower-arm-l", "lower-arm-r"],
  ["hand-l", "hand-r"],
  ["upper-leg-l", "upper-leg-r"],
  ["lower-leg-l", "lower-leg-r"],
  ["foot-l", "foot-r"],
].map(([leftId, rightId]) => ({ kind: "bone" as const, leftId, rightId }));

const PART_MIRROR_PAIRS = [
  ["part-upper-arm-l", "part-upper-arm-r"],
  ["part-lower-arm-l", "part-lower-arm-r"],
  ["part-hand-l", "part-hand-r"],
  ["part-upper-leg-l", "part-upper-leg-r"],
  ["part-lower-leg-l", "part-lower-leg-r"],
  ["part-foot-l", "part-foot-r"],
].map(([leftId, rightId]) => ({ kind: "part" as const, leftId, rightId }));

export function createDefaultHumanoidRecipe(
  options: CreateDefaultHumanoidOptions = {},
): AuthoredModelRecipe {
  const now = options.now ?? Date.now();
  const bones = Object.fromEntries(
    BONE_INPUTS.map((bone) => [
      bone.uuid,
      {
        ...bone,
        rotation: bone.rotation ?? [0, 0, 0],
        length: bone.length ?? 0.25,
      } satisfies AuthoredBone,
    ]),
  );
  const parts: Record<string, AuthoredPart> = {};
  const swatches = Object.fromEntries(
    DEFAULT_SWATCHES.map((swatch) => [swatch.uuid, swatch]),
  );

  return {
    uuid: options.uuid ?? generateUUID(),
    name: options.name ?? "Skeleton Character",
    kind: "skeleton",
    bones,
    boneOrder: BONE_INPUTS.map((bone) => bone.uuid),
    parts,
    partOrder: [],
    swatches,
    swatchOrder: DEFAULT_SWATCHES.map((swatch) => swatch.uuid),
    mirrorPairs: [...MIRROR_PAIRS, ...PART_MIRROR_PAIRS],
    selectedBoneId: "chest",
    selectedPartId: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function createPrimitiveAssetRecipe(
  options: CreatePrimitiveAssetOptions = {},
): AuthoredModelRecipe {
  const now = options.now ?? Date.now();
  const swatches = Object.fromEntries(
    DEFAULT_SWATCHES.map((swatch) => [swatch.uuid, swatch]),
  );
  const primitive = options.primitive ?? "box";
  const part = createAuthoredPart({
    uuid: "part-root",
    name: primitiveLabel(primitive),
    boneId: AUTHORED_WORLD_BONE_ID,
    primitive,
    swatchId: DEFAULT_SWATCHES[0].uuid,
    color: DEFAULT_SWATCHES[0].color,
    scale: [0.8, 0.8, 0.8],
  });

  return {
    uuid: options.uuid ?? generateUUID(),
    name: options.name ?? "Primitive Asset",
    kind: "primitive",
    bones: {},
    boneOrder: [],
    parts: { [part.uuid]: part },
    partOrder: [part.uuid],
    swatches,
    swatchOrder: DEFAULT_SWATCHES.map((swatch) => swatch.uuid),
    mirrorPairs: [],
    selectedBoneId: undefined,
    selectedPartId: part.uuid,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAuthoredModelObject(
  recipe: AuthoredModelRecipe,
  options: BuildAuthoredModelOptions = {},
): BuiltAuthoredModel {
  const root = new THREE.Group();
  root.name = recipe.name || "Authored Model";
  root.userData.authoredModelId = recipe.uuid;

  const boneObjects: Record<string, THREE.Group> = {};
  const partObjects: Record<string, THREE.Group> = {};

  for (const boneId of recipe.boneOrder) {
    const bone = recipe.bones[boneId];
    if (!bone) continue;
    const group = new THREE.Group();
    group.name = `bone_${safeName(bone.name)}_${bone.uuid}`;
    group.userData.authoredBoneId = bone.uuid;
    group.position.fromArray(bone.position);
    group.rotation.set(...bone.rotation);
    boneObjects[bone.uuid] = group;
  }

  for (const boneId of recipe.boneOrder) {
    const bone = recipe.bones[boneId];
    const group = bone ? boneObjects[bone.uuid] : undefined;
    if (!bone || !group) continue;
    const parent = bone.parentId ? boneObjects[bone.parentId] : root;
    parent?.add(group);
  }

  if (options.includeSkeleton && recipe.boneOrder.length > 0) {
    addSkeletonOverlay(recipe, boneObjects, options.selectedBoneId);
  }

  for (const partId of recipe.partOrder) {
    const part = recipe.parts[partId];
    const boneObject = part ? boneObjects[part.boneId] : undefined;
    if (!part || !part.visible) continue;
    const group = buildPartGroup(recipe, part);
    partObjects[part.uuid] = group;
    (boneObject ?? root).add(group);
  }

  root.updateMatrixWorld(true);
  return { object: root, boneObjects, partObjects };
}

export function applyAuthoredPose(
  recipe: AuthoredModelRecipe,
  pose: AuthoredPose,
): AuthoredModelRecipe {
  const next = cloneRecipe(recipe);
  for (const [boneId, values] of Object.entries(pose)) {
    const bone = next.bones[boneId];
    if (!bone) continue;
    next.bones[boneId] = {
      ...bone,
      position: values.position ?? bone.position,
      rotation: values.rotation ?? bone.rotation,
    };
  }
  next.updatedAt = Date.now();
  return next;
}

export function mirrorAuthoredSelection(
  recipe: AuthoredModelRecipe,
  selection: AuthoredMirrorSelection,
): AuthoredModelRecipe {
  const pair = recipe.mirrorPairs.find(
    (candidate) =>
      candidate.kind === selection.kind &&
      (candidate.leftId === selection.id || candidate.rightId === selection.id),
  );
  if (!pair) return recipe;

  const sourceId = selection.id;
  const targetId = pair.leftId === sourceId ? pair.rightId : pair.leftId;
  const next = cloneRecipe(recipe);

  if (selection.kind === "bone") {
    const source = recipe.bones[sourceId];
    const target = recipe.bones[targetId];
    if (!source || !target) return recipe;
    next.bones[targetId] = {
      ...target,
      position: mirrorPosition(source.position),
      rotation: mirrorRotation(source.rotation),
    };
  } else {
    const source = recipe.parts[sourceId];
    const target = recipe.parts[targetId];
    if (!source || !target) return recipe;
    next.parts[targetId] = {
      ...source,
      uuid: target.uuid,
      name: target.name,
      boneId: target.boneId,
      position: mirrorPosition(source.position),
      rotation: mirrorRotation(source.rotation),
      extrusions: source.extrusions.map((extrusion) => ({
        ...extrusion,
        face: mirrorFace(extrusion.face),
      })),
    };
  }

  next.updatedAt = Date.now();
  return next;
}

export function extrudeAuthoredPrimitive(
  part: AuthoredPart,
  face: AuthoredExtrudeFace,
  options: AuthoredExtrudeOptions,
): AuthoredPart {
  const distance =
    Math.abs(options.distance) < 0.01
      ? options.distance < 0
        ? -0.01
        : 0.01
      : options.distance;

  return {
    ...part,
    extrusions: [
      ...part.extrusions,
      {
        uuid: options.uuid ?? generateUUID(),
        face,
        distance,
        scale: options.scale ?? [0.8, 0.8],
      },
    ],
  };
}

export async function exportAuthoredModelGlb(
  recipe: AuthoredModelRecipe,
): Promise<ArrayBuffer> {
  const { object } = buildAuthoredModelObject(recipe);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          const json = JSON.stringify(result);
          resolve(new TextEncoder().encode(json).buffer);
        }
      },
      reject,
      { binary: true },
    );
  });
}

export function createAuthoredPart(
  input: {
    uuid?: string;
    name: string;
    boneId: string;
    primitive: AuthoredPrimitiveKind;
    swatchId: string;
    color: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
  },
): AuthoredPart {
  return {
    uuid: input.uuid ?? generateUUID(),
    name: input.name,
    boneId: input.boneId,
    primitive: input.primitive,
    position: input.position ?? [0, 0, 0],
    rotation: input.rotation ?? [0, 0, 0],
    scale: input.scale ?? [0.35, 0.35, 0.35],
    swatchId: input.swatchId,
    color: input.color,
    visible: true,
    extrusions: [],
  };
}

function buildPartGroup(
  recipe: AuthoredModelRecipe,
  part: AuthoredPart,
): THREE.Group {
  const swatch = recipe.swatches[part.swatchId];
  const material = createMaterial(swatch, part.color);
  const group = new THREE.Group();
  group.name = `part_${safeName(part.name)}_${part.uuid}`;
  group.userData.authoredPartId = part.uuid;
  group.userData.authoredBoneId = part.boneId;
  group.position.fromArray(part.position);
  group.rotation.set(...part.rotation);

  const mainMesh = new THREE.Mesh(createGeometry(part.primitive), material);
  mainMesh.name = `mesh_${safeName(part.name)}_${part.uuid}`;
  mainMesh.scale.fromArray(part.scale);
  if (part.primitive === "edges" || part.primitive === "wireframe") {
    const meshMaterial = mainMesh.material as THREE.MeshStandardMaterial;
    meshMaterial.wireframe = true;
  }
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

  for (const extrusion of part.extrusions) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.name = `extrude_${extrusion.face}_${extrusion.uuid}`;
    const placement = getExtrusionPlacement(part, extrusion);
    mesh.position.fromArray(placement.position);
    mesh.scale.fromArray(placement.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

function addSkeletonOverlay(
  recipe: AuthoredModelRecipe,
  boneObjects: Record<string, THREE.Group>,
  selectedBoneId?: string,
) {
  const jointMaterial = new THREE.MeshBasicMaterial({
    color: "#35f1bd",
    depthTest: false,
  });
  const selectedJointMaterial = new THREE.MeshBasicMaterial({
    color: "#facc15",
    depthTest: false,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#35f1bd",
    depthTest: false,
  });
  const selectedLineMaterial = new THREE.LineBasicMaterial({
    color: "#facc15",
    depthTest: false,
  });
  for (const boneId of recipe.boneOrder) {
    const bone = recipe.bones[boneId];
    const boneObject = boneObjects[boneId];
    if (!bone || !boneObject) continue;
    const isSelectedJoint = bone.uuid === selectedBoneId;
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(isSelectedJoint ? 0.06 : 0.035, 10, 8),
      isSelectedJoint ? selectedJointMaterial : jointMaterial,
    );
    joint.name = isSelectedJoint
      ? `joint_selected_${bone.uuid}`
      : `joint_${bone.uuid}`;
    joint.renderOrder = 10;
    boneObject.add(joint);

    const children = recipe.boneOrder
      .map((id) => recipe.bones[id])
      .filter((candidate) => candidate?.parentId === bone.uuid);
    for (const child of children) {
      const isSelectedLine =
        bone.uuid === selectedBoneId || child.uuid === selectedBoneId;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(...child.position),
      ]);
      const line = new THREE.Line(
        geometry,
        isSelectedLine ? selectedLineMaterial : lineMaterial,
      );
      line.name = `bone_line_${bone.uuid}_${child.uuid}`;
      line.renderOrder = isSelectedLine ? 11 : 9;
      boneObject.add(line);
    }
  }
}

function createGeometry(primitive: AuthoredPrimitiveKind): THREE.BufferGeometry {
  switch (primitive) {
    case "box":
    case "cube":
      return new THREE.BoxGeometry(1, 1, 1);
    case "plane":
      return new THREE.PlaneGeometry(1, 1, 1, 1);
    case "circle":
      return new THREE.CircleGeometry(0.5, 16);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1);
    case "cone":
      return new THREE.ConeGeometry(0.5, 1, 8, 1);
    case "sphere":
      return new THREE.SphereGeometry(0.5, 8, 6);
    case "capsule":
      return new THREE.CapsuleGeometry(0.35, 0.5, 4, 8);
    case "dodecahedron":
      return new THREE.DodecahedronGeometry(0.5, 0);
    case "edges":
      return new THREE.BoxGeometry(1, 1, 1);
    case "extrude": {
      const shape = new THREE.Shape()
        .moveTo(-0.4, -0.4)
        .lineTo(0.4, -0.4)
        .lineTo(0.4, 0.4)
        .lineTo(-0.4, 0.4)
        .lineTo(-0.4, -0.4);
      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.35,
        bevelEnabled: false,
      }).center();
    }
    case "icosahedron":
      return new THREE.IcosahedronGeometry(0.5, 0);
    case "lathe":
      return new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.15, -0.5),
          new THREE.Vector2(0.42, -0.24),
          new THREE.Vector2(0.34, 0.28),
          new THREE.Vector2(0.12, 0.5),
        ],
        10,
      );
    case "octahedron":
      return new THREE.OctahedronGeometry(0.5, 0);
    case "polyhedron":
      return new THREE.PolyhedronGeometry(
        [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1],
        [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2],
        0.5,
        0,
      );
    case "ring":
      return new THREE.RingGeometry(0.25, 0.5, 16);
    case "shape": {
      const shape = new THREE.Shape()
        .moveTo(0, 0.5)
        .lineTo(0.45, -0.2)
        .lineTo(0.18, -0.5)
        .lineTo(-0.35, -0.32)
        .lineTo(-0.4, 0.28)
        .lineTo(0, 0.5);
      return new THREE.ShapeGeometry(shape);
    }
    case "tetrahedron":
      return new THREE.TetrahedronGeometry(0.55, 0);
    case "torus":
      return new THREE.TorusGeometry(0.35, 0.12, 8, 18);
    case "torusKnot":
      return new THREE.TorusKnotGeometry(0.32, 0.08, 32, 8);
    case "tube": {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.45, -0.2, 0),
        new THREE.Vector3(-0.2, 0.25, 0.1),
        new THREE.Vector3(0.15, -0.1, -0.1),
        new THREE.Vector3(0.45, 0.24, 0),
      ]);
      return new THREE.TubeGeometry(curve, 18, 0.08, 8, false);
    }
    case "wireframe":
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

function createMaterial(
  swatch: AuthoredMaterialSwatch | undefined,
  fallbackColor: string,
) {
  return new THREE.MeshStandardMaterial({
    color: swatch?.color ?? fallbackColor,
    roughness: swatch?.roughness ?? 0.85,
    metalness: swatch?.metalness ?? 0,
    flatShading: swatch?.flatShading ?? true,
  });
}

function getExtrusionPlacement(
  part: AuthoredPart,
  extrusion: AuthoredPart["extrusions"][number],
) {
  const axis = getFaceAxes(extrusion.face);
  const sign = extrusion.face.startsWith("p") ? 1 : -1;
  const position: [number, number, number] = [0, 0, 0];
  const scale: [number, number, number] = [0, 0, 0];

  position[axis.normal] =
    sign * (part.scale[axis.normal] / 2 + extrusion.distance / 2);
  scale[axis.normal] = Math.max(0.01, Math.abs(extrusion.distance));
  scale[axis.a] = part.scale[axis.a] * extrusion.scale[0];
  scale[axis.b] = part.scale[axis.b] * extrusion.scale[1];

  return { position, scale };
}

function getFaceAxes(face: AuthoredExtrudeFace) {
  if (face.endsWith("x")) return { normal: 0, a: 1, b: 2 } as const;
  if (face.endsWith("y")) return { normal: 1, a: 0, b: 2 } as const;
  return { normal: 2, a: 0, b: 1 } as const;
}

function mirrorFace(face: AuthoredExtrudeFace): AuthoredExtrudeFace {
  if (face === "px") return "nx";
  if (face === "nx") return "px";
  return face;
}

function mirrorPosition(position: [number, number, number]) {
  return [-position[0], position[1], position[2]] as [number, number, number];
}

function mirrorRotation(rotation: [number, number, number]) {
  return [rotation[0], -rotation[1], -rotation[2]] as [
    number,
    number,
    number,
  ];
}

function cloneRecipe(recipe: AuthoredModelRecipe): AuthoredModelRecipe {
  return structuredClone(recipe);
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9_]+/gi, "_").replace(/^_+|_+$/g, "");
}

function primitiveLabel(primitive: AuthoredPrimitiveKind) {
  if (primitive === "torusKnot") return "Torus Knot";
  return primitive[0].toUpperCase() + primitive.slice(1);
}
