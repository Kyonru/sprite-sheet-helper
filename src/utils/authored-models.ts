import type {
  AuthoredAxisExtrudeFace,
  AuthoredBone,
  AuthoredExtrudeFace,
  AuthoredFaceEdit,
  AuthoredGeometryExtrudeFace,
  AuthoredExtrudeOptions,
  AuthoredMaterialSwatch,
  AuthoredMergedFaceGroup,
  AuthoredMirrorSelection,
  AuthoredModelRecipe,
  AuthoredPart,
  AuthoredPose,
  AuthoredPrimitiveKind,
  AuthoredVector3,
  AuthoredVertexEdit,
  BuildAuthoredModelOptions,
  BuiltAuthoredModel,
  CreateDefaultHumanoidOptions,
  CreatePrimitiveAssetOptions,
} from "@/types/authored-models";
import { generateUUID } from "@/utils/strings";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

export const AUTHORED_WORLD_BONE_ID = "__world";

export type AuthoredPrimitiveFaceTarget = {
  face: AuthoredGeometryExtrudeFace;
  mergedGroupId?: string;
};

type AuthoredPartFaceTargetOptions = {
  applyEdits?: boolean;
  applyMerges?: boolean;
};

type AuthoredTopologyTarget = {
  base: AuthoredPrimitiveFaceTarget;
  displayed: AuthoredPrimitiveFaceTarget;
  mergedGroupId?: string;
};

export type AuthoredTopologyVertex = {
  key: string;
  position: AuthoredVector3;
  faceKeys: string[];
  edgeKeys: string[];
};

export type AuthoredTopologyEdge = {
  key: string;
  vertexKeys: [string, string];
  start: AuthoredVector3;
  end: AuthoredVector3;
  center: AuthoredVector3;
  faceKeys: string[];
};

export type AuthoredTopologyFace = {
  key: string;
  face: AuthoredGeometryExtrudeFace;
  vertexKeys: string[];
  edgeKeys: string[];
  mergedGroupId?: string;
};

export type AuthoredPartTopology = {
  vertices: AuthoredTopologyVertex[];
  edges: AuthoredTopologyEdge[];
  faces: AuthoredTopologyFace[];
};

export type AuthoredComponentSelection = {
  vertexKeys?: string[];
  edgeKeys?: string[];
  faceKeys?: string[];
};

export type AuthoredComponentTransform = {
  center: AuthoredVector3;
  rotation: AuthoredVector3;
  scale: AuthoredVector3;
};

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
      faceEdits: (source.faceEdits ?? []).map(mirrorFaceEdit),
      vertexEdits: (source.vertexEdits ?? []).map(mirrorVertexEdit),
      deletedFaceKeys: [...(source.deletedFaceKeys ?? [])],
      mergedFaceGroups: structuredClone(source.mergedFaceGroups ?? []),
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
        scale: options.scale ?? [1, 1],
      },
    ],
  };
}

export function getAuthoredPrimitiveFaceTargets(
  primitive: AuthoredPrimitiveKind,
): AuthoredPrimitiveFaceTarget[] {
  return extractGeometryFaceTargets(
    createGeometry(primitive),
    primitive,
    "base",
    primitiveLabel(primitive),
    "primitive",
  );
}

export function getAuthoredPartFaceTargets(
  part: AuthoredPart,
  options: AuthoredPartFaceTargetOptions = {},
): AuthoredPrimitiveFaceTarget[] {
  const targets = [
    ...extractGeometryFaceTargets(
      createGeometry(part.primitive).applyMatrix4(
        new THREE.Matrix4().makeScale(
          part.scale[0],
          part.scale[1],
          part.scale[2],
        ),
      ),
      part.primitive,
      "base",
      primitiveLabel(part.primitive),
      "part",
    ),
    ...part.extrusions.flatMap((extrusion, index) =>
      extractGeometryFaceTargets(
        createExtrusionGeometry(part, extrusion),
        part.primitive,
        `extrusion:${extrusion.uuid}`,
        `Extrusion ${index + 1}`,
        "part",
      ),
    ),
  ];
  const deletedFaceKeys = new Set(part.deletedFaceKeys ?? []);
  const visibleTargets = targets.filter(
    (target) => !deletedFaceKeys.has(getAuthoredFaceKey(target.face)),
  );

  if (options.applyEdits === false) {
    return options.applyMerges === false
      ? visibleTargets
      : applyMergedFaceGroupsToTargets(visibleTargets, part);
  }
  const editedTargets = applyVertexEditsToTargets(
    applyFaceEditsToTargets(visibleTargets, part),
    part,
  );
  return options.applyMerges === false
    ? editedTargets
    : applyMergedFaceGroupsToTargets(editedTargets, part);
}

export function getAuthoredFaceKey(face: AuthoredExtrudeFace) {
  if (typeof face === "string") return face;
  return [
    face.sourceId ?? "base",
    face.primitive,
    face.index,
    face.triangles.length,
  ].join(":");
}

export function getAuthoredFaceEdit(
  part: AuthoredPart,
  face: AuthoredExtrudeFace,
) {
  const faceKey = getAuthoredFaceKey(face);
  return (part.faceEdits ?? []).find((edit) => edit.faceKey === faceKey);
}

export function upsertAuthoredFaceEdit(
  part: AuthoredPart,
  face: AuthoredExtrudeFace,
  props: Partial<Omit<AuthoredFaceEdit, "uuid" | "faceKey">>,
): AuthoredPart {
  const faceKey = getAuthoredFaceKey(face);
  const existing = getAuthoredFaceEdit(part, face);
  const nextEdit: AuthoredFaceEdit = {
    uuid: existing?.uuid ?? generateUUID(),
    faceKey,
    mode: props.mode ?? existing?.mode ?? "detached",
    position: props.position ?? existing?.position ?? [0, 0, 0],
    rotation: props.rotation ?? existing?.rotation ?? [0, 0, 0],
    scale: props.scale ?? existing?.scale ?? [1, 1],
  };
  const faceEdits = [
    ...(part.faceEdits ?? []).filter((edit) => edit.faceKey !== faceKey),
    nextEdit,
  ];
  return { ...part, faceEdits };
}

export function deleteAuthoredFace(
  part: AuthoredPart,
  face: AuthoredExtrudeFace,
): AuthoredPart {
  const faceKey = getAuthoredFaceKey(face);
  const deletedFaceKeys = new Set(part.deletedFaceKeys ?? []);
  deletedFaceKeys.add(faceKey);
  return {
    ...part,
    deletedFaceKeys: Array.from(deletedFaceKeys),
    faceEdits: (part.faceEdits ?? []).filter((edit) => edit.faceKey !== faceKey),
  };
}

export function updateAuthoredVertexEdits(
  part: AuthoredPart,
  edits: AuthoredVertexEdit[],
): AuthoredPart {
  return { ...part, vertexEdits: normalizeVertexEdits(edits) };
}

export function mergeAuthoredFaces(
  part: AuthoredPart,
  faceKeys: string[],
): AuthoredPart {
  const uniqueFaceKeys = uniqueStrings(faceKeys);
  if (uniqueFaceKeys.length !== 2) return part;
  const existingGroups = part.mergedFaceGroups ?? [];
  if (
    existingGroups.some((group) =>
      group.faceKeys.some((faceKey) => uniqueFaceKeys.includes(faceKey)),
    )
  ) {
    return part;
  }
  const topology = getAuthoredPartTopology(part, {
    applyEdits: true,
    applyMerges: false,
  });
  const adjacent = getAdjacentFacePairs(topology).some(
    ([first, second]) =>
      uniqueFaceKeys.includes(first) && uniqueFaceKeys.includes(second),
  );
  if (!adjacent) return part;
  const group: AuthoredMergedFaceGroup = {
    uuid: generateUUID(),
    faceKeys: uniqueFaceKeys,
    label: "Merged face",
  };
  return {
    ...part,
    mergedFaceGroups: [...existingGroups, group],
  };
}

export function unmergeAuthoredFaceGroup(
  part: AuthoredPart,
  groupId: string,
): AuthoredPart {
  return {
    ...part,
    mergedFaceGroups: (part.mergedFaceGroups ?? []).filter(
      (group) => group.uuid !== groupId,
    ),
  };
}

export function getAuthoredPartTopology(
  part: AuthoredPart,
  options: AuthoredPartFaceTargetOptions = {},
): AuthoredPartTopology {
  const baseTargets = getAuthoredPartFaceTargets(part, {
    applyEdits: false,
    applyMerges: false,
  });
  const displayedTargets =
    options.applyEdits === false
      ? baseTargets
      : applyVertexEditsToTargets(
          applyFaceEditsToTargets(baseTargets, part),
          part,
        );
  const displayedByFaceKey = new Map(
    displayedTargets.map((target) => [getAuthoredFaceKey(target.face), target]),
  );
  const pairs: AuthoredTopologyTarget[] = baseTargets.map((base) => ({
    base,
    displayed: displayedByFaceKey.get(getAuthoredFaceKey(base.face)) ?? base,
  }));
  const topologyTargets =
    options.applyMerges === false
      ? pairs
      : applyMergedFaceGroupsToTopologyTargets(pairs, part);
  const vertices = new Map<string, AuthoredTopologyVertex>();
  const edges = new Map<string, AuthoredTopologyEdge>();
  const faces: AuthoredTopologyFace[] = [];

  for (const target of topologyTargets) {
    const faceKey = getAuthoredFaceKey(target.base.face);
    const vertexKeys = uniqueStrings(
      target.base.face.triangles
        .flat()
        .map((vertex) => getTopologyVertexKey(part, target.base.face, vertex)),
    );
    const edgeKeys: string[] = [];
    const baseVertices = target.base.face.triangles.flat();
    const displayedVertices = target.displayed.face.triangles.flat();

    for (let index = 0; index < baseVertices.length; index += 1) {
      const baseVertex = baseVertices[index];
      const displayedVertex = displayedVertices[index] ?? baseVertex;
      const vertexKey = getTopologyVertexKey(part, target.base.face, baseVertex);
      const existing = vertices.get(vertexKey);
      if (existing) {
        if (!existing.faceKeys.includes(faceKey)) existing.faceKeys.push(faceKey);
      } else {
        vertices.set(vertexKey, {
          key: vertexKey,
          position: displayedVertex,
          faceKeys: [faceKey],
          edgeKeys: [],
        });
      }
    }

    for (const edge of getTopologyFaceBoundaryEdges(part, target)) {
      edgeKeys.push(edge.key);
      const existing = edges.get(edge.key);
      if (existing) {
        if (!existing.faceKeys.includes(faceKey)) existing.faceKeys.push(faceKey);
      } else {
        edges.set(edge.key, {
          key: edge.key,
          vertexKeys: edge.vertexKeys,
          start: edge.start,
          end: edge.end,
          center: [
            (edge.start[0] + edge.end[0]) / 2,
            (edge.start[1] + edge.end[1]) / 2,
            (edge.start[2] + edge.end[2]) / 2,
          ],
          faceKeys: [faceKey],
        });
      }
    }

    faces.push({
      key: faceKey,
      face: target.displayed.face,
      vertexKeys,
      edgeKeys: uniqueStrings(edgeKeys),
      mergedGroupId: target.mergedGroupId,
    });
  }

  for (const edge of edges.values()) {
    for (const vertexKey of edge.vertexKeys) {
      const vertex = vertices.get(vertexKey);
      if (vertex && !vertex.edgeKeys.includes(edge.key)) {
        vertex.edgeKeys.push(edge.key);
      }
    }
  }

  return {
    vertices: Array.from(vertices.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    edges: Array.from(edges.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    faces,
  };
}

export function getAdjacentFacePairs(topology: AuthoredPartTopology) {
  const pairs: [string, string][] = [];
  for (const edge of topology.edges) {
    const faceKeys = uniqueStrings(edge.faceKeys);
    if (faceKeys.length < 2) continue;
    for (let i = 0; i < faceKeys.length; i += 1) {
      for (let j = i + 1; j < faceKeys.length; j += 1) {
        pairs.push([faceKeys[i], faceKeys[j]]);
      }
    }
  }
  return pairs;
}

export function transformAuthoredComponentSelection(
  part: AuthoredPart,
  selection: AuthoredComponentSelection,
  transform: AuthoredComponentTransform,
): AuthoredPart {
  const topology = getAuthoredPartTopology(part);
  const vertexKeys = getSelectedTopologyVertexKeys(topology, selection);
  if (vertexKeys.length === 0) return part;

  const selectedVertices = vertexKeys
    .map((vertexKey) =>
      topology.vertices.find((vertex) => vertex.key === vertexKey),
    )
    .filter(Boolean) as AuthoredTopologyVertex[];
  if (selectedVertices.length === 0) return part;

  const sourceCenter = getAuthoredVectorCenter(
    selectedVertices.map((vertex) => vertex.position),
  );
  const targetCenter = vectorFromArray(transform.center);
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...transform.rotation),
  );
  const scale = new THREE.Vector3(...transform.scale);
  const existingEdits = new Map(
    (part.vertexEdits ?? []).map((edit) => [edit.vertexKey, edit.offset]),
  );
  const selectedSet = new Set(vertexKeys);
  const nextEdits = (part.vertexEdits ?? []).filter(
    (edit) => !selectedSet.has(edit.vertexKey),
  );

  for (const vertex of selectedVertices) {
    const currentPosition = vectorFromArray(vertex.position);
    const transformedPosition = targetCenter
      .clone()
      .add(
        currentPosition
          .clone()
          .sub(vectorFromArray(sourceCenter))
          .multiply(scale)
          .applyQuaternion(rotation),
      );
    const existingOffset = vectorFromArray(
      existingEdits.get(vertex.key) ?? [0, 0, 0],
    );
    const nextOffset = existingOffset.add(
      transformedPosition.clone().sub(currentPosition),
    );
    if (nextOffset.lengthSq() > 1e-12) {
      nextEdits.push({
        vertexKey: vertex.key,
        offset: vectorToArray(nextOffset),
      });
    }
  }

  return updateAuthoredVertexEdits(part, nextEdits);
}

function extractGeometryFaceTargets(
  sourceGeometry: THREE.BufferGeometry,
  primitive: AuthoredPrimitiveKind,
  sourceId: string,
  labelPrefix: string,
  space: "primitive" | "part",
): AuthoredPrimitiveFaceTarget[] {
  const geometry = sourceGeometry.toNonIndexed();
  const position = geometry.getAttribute("position");
  if (!position) return [];

  const groups = new Map<
    string,
    {
      normal: THREE.Vector3;
      plane: number;
      triangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
    }
  >();

  for (let index = 0; index < position.count; index += 3) {
    const a = vectorFromAttribute(position, index);
    const b = vectorFromAttribute(position, index + 1);
    const c = vectorFromAttribute(position, index + 2);
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a));
    if (normal.lengthSq() < 1e-8) continue;
    normal.normalize();
    const plane = normal.dot(a);
    const key = [
      quantize(normal.x),
      quantize(normal.y),
      quantize(normal.z),
      quantize(plane),
    ].join("|");
    const group = groups.get(key);
    if (group) {
      group.triangles.push([a, b, c]);
    } else {
      groups.set(key, { normal, plane, triangles: [[a, b, c]] });
    }
  }

  return Array.from(groups.values()).map((group, index) => {
    const center = getTriangleCenter(group.triangles);
    const face: AuthoredGeometryExtrudeFace = {
      kind: "geometry",
      primitive,
      sourceId,
      space,
      index,
      label: `${labelPrefix} face ${index + 1}`,
      center: vectorToArray(center),
      normal: vectorToArray(group.normal),
      triangles: group.triangles.map((triangle) => [
        vectorToArray(triangle[0]),
        vectorToArray(triangle[1]),
        vectorToArray(triangle[2]),
      ]),
    };
    return { face };
  });
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
    faceEdits: [],
    vertexEdits: [],
    deletedFaceKeys: [],
    mergedFaceGroups: [],
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

  const mainMesh = new THREE.Mesh(createAuthoredPartGeometry(part), material);
  mainMesh.name = `mesh_${safeName(part.name)}_${part.uuid}`;
  if (part.primitive === "edges" || part.primitive === "wireframe") {
    const meshMaterial = mainMesh.material as THREE.MeshStandardMaterial;
    meshMaterial.wireframe = true;
  }
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  group.add(mainMesh);

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

function createAuthoredPartGeometry(part: AuthoredPart) {
  const positions: number[] = [];
  for (const target of getAuthoredPartFaceTargets(part)) {
    for (const triangle of target.face.triangles) {
      pushTriangle(
        positions,
        vectorFromArray(triangle[0]),
        vectorFromArray(triangle[1]),
        vectorFromArray(triangle[2]),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createExtrusionGeometry(
  part: AuthoredPart,
  extrusion: AuthoredPart["extrusions"][number],
) {
  if (isGeometryExtrudeFace(extrusion.face)) {
    return createGeometryFaceExtrusionGeometry(part, extrusion);
  }

  const placement = getExtrusionPlacement(part, extrusion);
  const matrix = new THREE.Matrix4().makeScale(
    placement.scale[0],
    placement.scale[1],
    placement.scale[2],
  );
  matrix.setPosition(
    placement.position[0],
    placement.position[1],
    placement.position[2],
  );
  return new THREE.BoxGeometry(1, 1, 1).applyMatrix4(
    matrix,
  );
}

function getExtrusionPlacement(
  part: AuthoredPart,
  extrusion: AuthoredPart["extrusions"][number],
) {
  if (!isAxisExtrudeFace(extrusion.face)) {
    return { position: [0, 0, 0], scale: [1, 1, 1] } as const;
  }
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

function createGeometryFaceExtrusionGeometry(
  part: AuthoredPart,
  extrusion: AuthoredPart["extrusions"][number],
) {
  if (!isGeometryExtrudeFace(extrusion.face)) {
    return new THREE.BoxGeometry(1, 1, 1);
  }
  const face = extrusion.face;

  const triangles = face.triangles
    .map((triangle) =>
      triangle.map((vertex) =>
        face.space === "part"
          ? vectorFromArray(vertex)
          : scalePrimitiveVertex(vertex, part.scale),
      ),
    )
    .filter((triangle) => triangle.length === 3) as [
    THREE.Vector3,
    THREE.Vector3,
    THREE.Vector3,
  ][];
  if (triangles.length === 0) return new THREE.BufferGeometry();

  const center = getTriangleCenter(triangles);
  const normal = getScaledFaceNormal(triangles, face.normal);
  const basisU = getFaceBasisU(triangles, normal);
  const basisV = new THREE.Vector3().crossVectors(normal, basisU).normalize();
  const capPosition = new THREE.Vector3(...(extrusion.position ?? [0, 0, 0]));
  const capRotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...(extrusion.rotation ?? [0, 0, 0])),
  );

  const baseTriangles = triangles;
  const tipByBaseVertex = new Map<string, THREE.Vector3>();
  const tipTriangles = baseTriangles.map((triangle) =>
    triangle.map((vertex) => {
      const scaled = scaleFaceVertex(
        vertex,
        center,
        normal,
        basisU,
        basisV,
        extrusion.scale,
      );
      const transformed = center
        .clone()
        .add(new THREE.Vector3().subVectors(scaled, center).applyQuaternion(capRotation))
        .add(capPosition)
        .addScaledVector(normal, extrusion.distance);
      tipByBaseVertex.set(getVertexKey(vertex), transformed);
      return transformed;
    }),
  ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3][];

  const positions: number[] = [];
  for (const triangle of tipTriangles) {
    pushTriangle(positions, triangle[0], triangle[1], triangle[2]);
  }

  for (const edge of getBoundaryEdges(baseTriangles)) {
    const tipA =
      tipByBaseVertex.get(getVertexKey(edge.a)) ??
      edge.a.clone().add(capPosition).addScaledVector(normal, extrusion.distance);
    const tipB =
      tipByBaseVertex.get(getVertexKey(edge.b)) ??
      edge.b.clone().add(capPosition).addScaledVector(normal, extrusion.distance);
    pushTriangle(positions, edge.a, edge.b, tipB);
    pushTriangle(positions, edge.a, tipB, tipA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function applyFaceEditsToTargets(
  targets: AuthoredPrimitiveFaceTarget[],
  part: AuthoredPart,
): AuthoredPrimitiveFaceTarget[] {
  const editsByFaceKey = new Map(
    (part.faceEdits ?? []).map((edit) => [edit.faceKey, edit]),
  );
  if (editsByFaceKey.size === 0) return targets;

  const connectedVertices = new Map<string, AuthoredVector3>();

  for (const target of targets) {
    const edit = editsByFaceKey.get(getAuthoredFaceKey(target.face));
    if (edit?.mode !== "connected") continue;
    for (const sourceTriangle of target.face.triangles) {
      const transformedTriangle = transformFaceTriangle(
        sourceTriangle,
        target.face,
        edit,
      );
      sourceTriangle.forEach((vertex, index) => {
        connectedVertices.set(
          getAuthoredVertexKey(vertex),
          transformedTriangle[index],
        );
      });
    }
  }

  return targets.map((target) => {
    const edit = editsByFaceKey.get(getAuthoredFaceKey(target.face));
    if (edit && edit.mode !== "connected") {
      return createEditedFaceTarget(
        target,
        target.face.triangles.map((triangle) =>
          transformFaceTriangle(triangle, target.face, edit),
        ),
      );
    }

    if (connectedVertices.size === 0) return target;
    let changed = false;
    const triangles = target.face.triangles.map((triangle) =>
      triangle.map((vertex) => {
        const connectedVertex = connectedVertices.get(getAuthoredVertexKey(vertex));
        if (!connectedVertex) return vertex;
        changed = true;
        return connectedVertex;
      }) as [AuthoredVector3, AuthoredVector3, AuthoredVector3],
    );
    return changed ? createEditedFaceTarget(target, triangles) : target;
  });
}

export function applyVertexEditsToTargets(
  targets: AuthoredPrimitiveFaceTarget[],
  part: AuthoredPart,
): AuthoredPrimitiveFaceTarget[] {
  const edits = new Map(
    (part.vertexEdits ?? []).map((edit) => [edit.vertexKey, edit.offset]),
  );
  if (edits.size === 0) return targets;
  return targets.map((target) => {
    let changed = false;
    const triangles = target.face.triangles.map((triangle) =>
      triangle.map((vertex) => {
        const offset = edits.get(getAuthoredVertexKey(vertex));
        if (!offset) return vertex;
        changed = true;
        return [
          vertex[0] + offset[0],
          vertex[1] + offset[1],
          vertex[2] + offset[2],
        ] as AuthoredVector3;
      }) as [AuthoredVector3, AuthoredVector3, AuthoredVector3],
    );
    return changed ? createEditedFaceTarget(target, triangles) : target;
  });
}

function applyMergedFaceGroupsToTargets(
  targets: AuthoredPrimitiveFaceTarget[],
  part: AuthoredPart,
): AuthoredPrimitiveFaceTarget[] {
  const groups = part.mergedFaceGroups ?? [];
  if (groups.length === 0) return targets;

  const targetByFaceKey = new Map(
    targets.map((target) => [getAuthoredFaceKey(target.face), target]),
  );
  const deletedFaceKeys = new Set(part.deletedFaceKeys ?? []);
  const hiddenFaceKeys = new Set<string>();
  const mergedTargets: AuthoredPrimitiveFaceTarget[] = [];

  for (const group of groups) {
    const groupTargets = group.faceKeys
      .map((faceKey) => targetByFaceKey.get(faceKey))
      .filter(Boolean) as AuthoredPrimitiveFaceTarget[];
    if (groupTargets.length < 2) continue;
    const face = createMergedGeometryFace(group, groupTargets);
    if (deletedFaceKeys.has(getAuthoredFaceKey(face))) continue;
    group.faceKeys.forEach((faceKey) => hiddenFaceKeys.add(faceKey));
    mergedTargets.push({
      mergedGroupId: group.uuid,
      face,
    });
  }

  return [
    ...targets.filter(
      (target) => !hiddenFaceKeys.has(getAuthoredFaceKey(target.face)),
    ),
    ...mergedTargets,
  ];
}

function applyMergedFaceGroupsToTopologyTargets(
  targets: AuthoredTopologyTarget[],
  part: AuthoredPart,
): AuthoredTopologyTarget[] {
  const groups = part.mergedFaceGroups ?? [];
  if (groups.length === 0) return targets;

  const targetByFaceKey = new Map(
    targets.map((target) => [getAuthoredFaceKey(target.base.face), target]),
  );
  const deletedFaceKeys = new Set(part.deletedFaceKeys ?? []);
  const hiddenFaceKeys = new Set<string>();
  const mergedTargets: AuthoredTopologyTarget[] = [];

  for (const group of groups) {
    const groupTargets = group.faceKeys
      .map((faceKey) => targetByFaceKey.get(faceKey))
      .filter(Boolean) as AuthoredTopologyTarget[];
    if (groupTargets.length < 2) continue;
    const baseFace = createMergedGeometryFace(
      group,
      groupTargets.map((target) => target.base),
    );
    const displayedFace = createMergedGeometryFace(
      group,
      groupTargets.map((target) => target.displayed),
    );
    if (deletedFaceKeys.has(getAuthoredFaceKey(baseFace))) continue;
    group.faceKeys.forEach((faceKey) => hiddenFaceKeys.add(faceKey));
    mergedTargets.push({
      mergedGroupId: group.uuid,
      base: { face: baseFace, mergedGroupId: group.uuid },
      displayed: { face: displayedFace, mergedGroupId: group.uuid },
    });
  }

  return [
    ...targets.filter(
      (target) => !hiddenFaceKeys.has(getAuthoredFaceKey(target.base.face)),
    ),
    ...mergedTargets,
  ];
}

function createMergedGeometryFace(
  group: AuthoredMergedFaceGroup,
  targets: AuthoredPrimitiveFaceTarget[],
): AuthoredGeometryExtrudeFace {
  const triangles = targets.flatMap((target) => target.face.triangles);
  const vectorTriangles = triangles.map((triangle) =>
    triangle.map(vectorFromArray),
  ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
  const center = getTriangleCenter(vectorTriangles);
  const normal = getScaledFaceNormal(vectorTriangles, targets[0].face.normal);

  return {
    kind: "geometry",
    primitive: targets[0].face.primitive,
    sourceId: `merged:${group.uuid}`,
    space: "part",
    index: 0,
    label: group.label ?? "Merged face",
    center: vectorToArray(center),
    normal: vectorToArray(normal),
    triangles,
  };
}

function createEditedFaceTarget(
  target: AuthoredPrimitiveFaceTarget,
  triangles: [AuthoredVector3, AuthoredVector3, AuthoredVector3][],
): AuthoredPrimitiveFaceTarget {
  const vectorTriangles = triangles.map((triangle) =>
    triangle.map(vectorFromArray),
  ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
  const center = getTriangleCenter(vectorTriangles);
  const normal = getScaledFaceNormal(vectorTriangles, target.face.normal);

  return {
    ...target,
    face: {
      ...target.face,
      center: vectorToArray(center),
      normal: vectorToArray(normal),
      triangles,
    },
  };
}

function transformFaceTriangle(
  triangle: [AuthoredVector3, AuthoredVector3, AuthoredVector3],
  face: AuthoredGeometryExtrudeFace,
  edit: AuthoredFaceEdit,
): [AuthoredVector3, AuthoredVector3, AuthoredVector3] {
  const sourceTriangles = face.triangles.map((sourceTriangle) =>
    sourceTriangle.map(vectorFromArray),
  ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3][];
  const center = new THREE.Vector3(...face.center);
  const normal = getScaledFaceNormal(sourceTriangles, face.normal);
  const basisU = getFaceBasisU(sourceTriangles, normal);
  const basisV = new THREE.Vector3().crossVectors(normal, basisU).normalize();
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...edit.rotation),
  );
  const position = new THREE.Vector3(...edit.position);

  return triangle.map((vertex) => {
    const scaled = scaleFaceVertex(
      vectorFromArray(vertex),
      center,
      normal,
      basisU,
      basisV,
      edit.scale,
    );
    const transformed = center
      .clone()
      .add(new THREE.Vector3().subVectors(scaled, center).applyQuaternion(quaternion))
      .add(position);
    return vectorToArray(transformed);
  }) as [AuthoredVector3, AuthoredVector3, AuthoredVector3];
}

function getFaceAxes(face: AuthoredAxisExtrudeFace) {
  if (face.endsWith("x")) return { normal: 0, a: 1, b: 2 } as const;
  if (face.endsWith("y")) return { normal: 1, a: 0, b: 2 } as const;
  return { normal: 2, a: 0, b: 1 } as const;
}

function getSelectedTopologyVertexKeys(
  topology: AuthoredPartTopology,
  selection: AuthoredComponentSelection,
) {
  const vertexKeys = new Set(selection.vertexKeys ?? []);
  const selectedEdgeKeys = new Set(selection.edgeKeys ?? []);
  const selectedFaceKeys = new Set(selection.faceKeys ?? []);

  for (const edge of topology.edges) {
    if (!selectedEdgeKeys.has(edge.key)) continue;
    edge.vertexKeys.forEach((vertexKey) => vertexKeys.add(vertexKey));
  }

  for (const face of topology.faces) {
    if (!selectedFaceKeys.has(face.key)) continue;
    face.vertexKeys.forEach((vertexKey) => vertexKeys.add(vertexKey));
  }

  return Array.from(vertexKeys).sort();
}

function normalizeVertexEdits(edits: AuthoredVertexEdit[]) {
  const normalized = new Map<string, AuthoredVertexEdit>();
  for (const edit of edits) {
    const offset = edit.offset.map((value) =>
      Math.abs(value) < 1e-10 ? 0 : value,
    ) as AuthoredVector3;
    if (offset.every((value) => value === 0)) {
      normalized.delete(edit.vertexKey);
      continue;
    }
    normalized.set(edit.vertexKey, { vertexKey: edit.vertexKey, offset });
  }
  return Array.from(normalized.values()).sort((a, b) =>
    a.vertexKey.localeCompare(b.vertexKey),
  );
}

function getAuthoredVectorCenter(vectors: AuthoredVector3[]) {
  if (vectors.length === 0) return [0, 0, 0] as AuthoredVector3;
  const sum: AuthoredVector3 = [0, 0, 0];
  for (const vector of vectors) {
    sum[0] += vector[0];
    sum[1] += vector[1];
    sum[2] += vector[2];
  }
  return [
    sum[0] / vectors.length,
    sum[1] / vectors.length,
    sum[2] / vectors.length,
  ] as AuthoredVector3;
}

function getTopologyFaceBoundaryEdges(
  part: AuthoredPart,
  target: AuthoredTopologyTarget,
) {
  const edges = new Map<
    string,
    {
      key: string;
      vertexKeys: [string, string];
      start: AuthoredVector3;
      end: AuthoredVector3;
      count: number;
    }
  >();
  for (let triangleIndex = 0; triangleIndex < target.base.face.triangles.length; triangleIndex += 1) {
    const baseTriangle = target.base.face.triangles[triangleIndex];
    const displayedTriangle =
      target.displayed.face.triangles[triangleIndex] ?? baseTriangle;
    for (const [startIndex, endIndex] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as [number, number][]) {
      const startKey = getTopologyVertexKey(
        part,
        target.base.face,
        baseTriangle[startIndex],
      );
      const endKey = getTopologyVertexKey(
        part,
        target.base.face,
        baseTriangle[endIndex],
      );
      const key = getAuthoredEdgeKey(startKey, endKey);
      const existing = edges.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const start = displayedTriangle[startIndex] ?? baseTriangle[startIndex];
        const end = displayedTriangle[endIndex] ?? baseTriangle[endIndex];
        edges.set(key, {
          key,
          vertexKeys:
            startKey < endKey ? [startKey, endKey] : [endKey, startKey],
          start,
          end,
          count: 1,
        });
      }
    }
  }
  return Array.from(edges.values()).filter((edge) => edge.count === 1);
}

function getTopologyVertexKey(
  part: AuthoredPart,
  face: AuthoredGeometryExtrudeFace,
  vertex: AuthoredVector3,
) {
  const key = getAuthoredVertexKey(vertex);
  const edit = getAuthoredFaceEdit(part, face);
  return edit?.mode === "detached" ? `${key}@${getAuthoredFaceKey(face)}` : key;
}

function getAuthoredEdgeKey(firstVertexKey: string, secondVertexKey: string) {
  return firstVertexKey < secondVertexKey
    ? `${firstVertexKey}|${secondVertexKey}`
    : `${secondVertexKey}|${firstVertexKey}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function mirrorFace(face: AuthoredExtrudeFace): AuthoredExtrudeFace {
  if (face === "px") return "nx";
  if (face === "nx") return "px";
  if (isGeometryExtrudeFace(face)) {
    return {
      ...face,
      label: `${face.label} mirrored`,
      center: mirrorPosition(face.center),
      normal: mirrorPosition(face.normal),
      triangles: face.triangles.map((triangle) => [
        mirrorPosition(triangle[0]),
        mirrorPosition(triangle[2]),
        mirrorPosition(triangle[1]),
      ]),
    };
  }
  return face;
}

function mirrorFaceEdit(edit: AuthoredFaceEdit): AuthoredFaceEdit {
  return {
    ...edit,
    faceKey: `${edit.faceKey}:mirrored`,
    position: mirrorPosition(edit.position),
    rotation: mirrorRotation(edit.rotation),
  };
}

function mirrorVertexEdit(edit: AuthoredVertexEdit): AuthoredVertexEdit {
  return {
    ...edit,
    vertexKey: getAuthoredVertexKey(mirrorPosition(keyToVector(edit.vertexKey))),
    offset: mirrorPosition(edit.offset),
  };
}

function isAxisExtrudeFace(
  face: AuthoredExtrudeFace,
): face is AuthoredAxisExtrudeFace {
  return typeof face === "string";
}

function isGeometryExtrudeFace(
  face: AuthoredExtrudeFace,
): face is AuthoredGeometryExtrudeFace {
  return typeof face !== "string" && face.kind === "geometry";
}

function vectorFromAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
) {
  return new THREE.Vector3(
    attribute.getX(index),
    attribute.getY(index),
    attribute.getZ(index),
  );
}

function vectorFromArray(vector: AuthoredVector3) {
  return new THREE.Vector3(vector[0], vector[1], vector[2]);
}

function vectorToArray(vector: THREE.Vector3): AuthoredVector3 {
  return [vector.x, vector.y, vector.z];
}

function quantize(value: number) {
  return Math.round(value * 10000) / 10000;
}

function getTriangleCenter(
  triangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][],
) {
  const center = new THREE.Vector3();
  let count = 0;
  for (const triangle of triangles) {
    for (const vertex of triangle) {
      center.add(vertex);
      count += 1;
    }
  }
  return count > 0 ? center.multiplyScalar(1 / count) : center;
}

function scalePrimitiveVertex(
  vertex: AuthoredVector3,
  scale: AuthoredVector3,
) {
  return new THREE.Vector3(
    vertex[0] * scale[0],
    vertex[1] * scale[1],
    vertex[2] * scale[2],
  );
}

function getScaledFaceNormal(
  triangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][],
  fallback: AuthoredVector3,
) {
  for (const triangle of triangles) {
    const normal = new THREE.Vector3()
      .subVectors(triangle[1], triangle[0])
      .cross(new THREE.Vector3().subVectors(triangle[2], triangle[0]));
    if (normal.lengthSq() > 1e-8) return normal.normalize();
  }
  return new THREE.Vector3(...fallback).normalize();
}

function getFaceBasisU(
  triangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][],
  normal: THREE.Vector3,
) {
  for (const triangle of triangles) {
    const edges = [
      new THREE.Vector3().subVectors(triangle[1], triangle[0]),
      new THREE.Vector3().subVectors(triangle[2], triangle[1]),
      new THREE.Vector3().subVectors(triangle[0], triangle[2]),
    ];
    for (const edge of edges) {
      edge.addScaledVector(normal, -edge.dot(normal));
      if (edge.lengthSq() > 1e-8) return edge.normalize();
    }
  }
  return new THREE.Vector3(1, 0, 0);
}

function scaleFaceVertex(
  vertex: THREE.Vector3,
  center: THREE.Vector3,
  normal: THREE.Vector3,
  basisU: THREE.Vector3,
  basisV: THREE.Vector3,
  scale: [number, number],
) {
  const offset = new THREE.Vector3().subVectors(vertex, center);
  return center
    .clone()
    .addScaledVector(basisU, offset.dot(basisU) * scale[0])
    .addScaledVector(basisV, offset.dot(basisV) * scale[1])
    .addScaledVector(normal, offset.dot(normal));
}

function getBoundaryEdges(
  triangles: [THREE.Vector3, THREE.Vector3, THREE.Vector3][],
) {
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>();
  for (const triangle of triangles) {
    for (const [a, b] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ] as [THREE.Vector3, THREE.Vector3][]) {
      const key = getEdgeKey(a, b);
      const edge = edges.get(key);
      if (edge) {
        edge.count += 1;
      } else {
        edges.set(key, { a, b, count: 1 });
      }
    }
  }
  return Array.from(edges.values()).filter((edge) => edge.count === 1);
}

function getEdgeKey(a: THREE.Vector3, b: THREE.Vector3) {
  const aKey = getVertexKey(a);
  const bKey = getVertexKey(b);
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function getVertexKey(vertex: THREE.Vector3) {
  return `${quantize(vertex.x)},${quantize(vertex.y)},${quantize(vertex.z)}`;
}

function getAuthoredVertexKey(vertex: AuthoredVector3) {
  return `${quantize(vertex[0])},${quantize(vertex[1])},${quantize(vertex[2])}`;
}

function keyToVector(key: string): AuthoredVector3 {
  const [x = 0, y = 0, z = 0] = key.split(",").map(Number);
  return [x, y, z];
}

function pushTriangle(
  positions: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
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
