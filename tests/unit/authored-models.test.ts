import { describe, expect, it } from "vitest";
import {
  buildAuthoredModelObject,
  createAuthoredPart,
  createDefaultHumanoidRecipe,
  createPrimitiveAssetRecipe,
  deleteAuthoredFace,
  extrudeAuthoredPrimitive,
  getAuthoredFaceKey,
  getAuthoredPartFaceTargets,
  getAuthoredPartTopology,
  getAuthoredPrimitiveFaceTargets,
  getAdjacentFacePairs,
  mergeAuthoredFaces,
  mirrorAuthoredSelection,
  transformAuthoredComponentSelection,
  unmergeAuthoredFaceGroup,
  upsertAuthoredFaceEdit,
} from "@/utils/authored-models";

describe("authored model utilities", () => {
  it("creates a deterministic skeleton-first humanoid recipe", () => {
    const recipe = createDefaultHumanoidRecipe({
      uuid: "recipe-a",
      name: "Hero",
      now: 1,
    });

    expect(recipe.uuid).toBe("recipe-a");
    expect(recipe.name).toBe("Hero");
    expect(recipe.boneOrder).toContain("hips");
    expect(recipe.boneOrder).toContain("head");
    expect(recipe.partOrder).toEqual([]);
    expect(recipe.parts).toEqual({});
    expect(recipe.mirrorPairs).toContainEqual({
      kind: "bone",
      leftId: "upper-arm-l",
      rightId: "upper-arm-r",
    });
  });

  it("builds a stable Three object with named bone and part groups", () => {
    const recipe = createDefaultHumanoidRecipe({
      uuid: "recipe-a",
      name: "Hero",
      now: 1,
    });
    const part = createAuthoredPart({
      uuid: "part-torso",
      name: "Torso",
      boneId: "spine",
      primitive: "cube",
      swatchId: "swatch-cloth",
      color: "#405f8f",
      scale: [0.6, 0.7, 0.3],
    });
    recipe.parts[part.uuid] = part;
    recipe.partOrder.push(part.uuid);

    const built = buildAuthoredModelObject(recipe, { includeSkeleton: true });
    const names: string[] = [];
    built.object.traverse((object) => names.push(object.name));

    expect(built.object.name).toBe("Hero");
    expect(names).toContain("bone_Chest_chest");
    expect(names).toContain("part_Torso_part-torso");
    expect(built.boneObjects.head).toBeDefined();
    expect(built.partObjects["part-torso"]).toBeDefined();
  });

  it("marks the selected skeleton bone in the editor overlay", () => {
    const recipe = createDefaultHumanoidRecipe({
      uuid: "recipe-a",
      name: "Hero",
      now: 1,
    });

    const built = buildAuthoredModelObject(recipe, {
      includeSkeleton: true,
      selectedBoneId: "chest",
    });
    const names: string[] = [];
    built.object.traverse((object) => names.push(object.name));

    expect(names).toContain("joint_selected_chest");
    expect(names).toContain("bone_line_spine_chest");
    expect(names).toContain("bone_line_chest_neck");
  });

  it("creates primitive-only assets without a skeleton", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "prop-a",
      name: "Quick Prop",
      primitive: "torus",
      now: 1,
    });

    const built = buildAuthoredModelObject(recipe, { includeSkeleton: true });

    expect(recipe.kind).toBe("primitive");
    expect(recipe.boneOrder).toEqual([]);
    expect(recipe.partOrder).toEqual(["part-root"]);
    expect(recipe.parts["part-root"].primitive).toBe("torus");
    expect(built.boneObjects).toEqual({});
    expect(built.partObjects["part-root"]).toBeDefined();
  });

  it("adds blocky extrusion steps without mutating the source part", () => {
    const source = createAuthoredPart({
      uuid: "part-torso",
      name: "Torso",
      boneId: "spine",
      primitive: "cube",
      swatchId: "swatch-cloth",
      color: "#405f8f",
    });

    const extruded = extrudeAuthoredPrimitive(source, "pz", {
      uuid: "extrude-a",
      distance: 0.25,
      scale: [0.5, 0.75],
    });

    expect(source.extrusions).toHaveLength(0);
    expect(extruded.extrusions).toEqual([
      { uuid: "extrude-a", face: "pz", distance: 0.25, scale: [0.5, 0.75] },
    ]);
  });

  it("keeps inward extrusion distances signed", () => {
    const source = createAuthoredPart({
      uuid: "part-torso",
      name: "Torso",
      boneId: "spine",
      primitive: "box",
      swatchId: "swatch-cloth",
      color: "#405f8f",
    });

    const extruded = extrudeAuthoredPrimitive(source, "pz", {
      uuid: "extrude-in",
      distance: -0.25,
      scale: [1, 1],
    });

    expect(extruded.extrusions[0]).toMatchObject({
      face: "pz",
      distance: -0.25,
    });
  });

  it("preserves the selected face shape by default when extruding", () => {
    const source = createAuthoredPart({
      uuid: "part-torso",
      name: "Torso",
      boneId: "spine",
      primitive: "box",
      swatchId: "swatch-cloth",
      color: "#405f8f",
    });

    const extruded = extrudeAuthoredPrimitive(source, "py", {
      uuid: "extrude-face",
      distance: 0.25,
    });

    expect(extruded.extrusions[0]).toMatchObject({
      face: "py",
      scale: [1, 1],
    });
  });

  it("extracts selectable faces from primitive geometry", () => {
    const coneFaces = getAuthoredPrimitiveFaceTargets("cone");

    expect(coneFaces.length).toBeGreaterThan(6);
    expect(
      coneFaces.some((target) => target.face.triangles.length === 1),
    ).toBe(true);
  });

  it("builds extrudable geometry from selected primitive faces", () => {
    const face = getAuthoredPrimitiveFaceTargets("cone")[0]?.face;
    expect(face).toBeDefined();
    const recipe = createPrimitiveAssetRecipe({
      uuid: "cone-prop",
      primitive: "cone",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    recipe.parts["part-root"] = extrudeAuthoredPrimitive(part, face!, {
      uuid: "extrude-cone-face",
      distance: 0.2,
    });

    const built = buildAuthoredModelObject(recipe);
    const targets = getAuthoredPartFaceTargets(recipe.parts["part-root"]);

    expect(built.partObjects["part-root"]).toBeDefined();
    expect(targets.some((target) => target.face.sourceId === "base")).toBe(
      true,
    );
    expect(
      targets.some(
        (target) => target.face.sourceId === "extrusion:extrude-cone-face",
      ),
    ).toBe(true);
  });

  it("applies connected extrusion cap transforms to generated geometry", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const face = getAuthoredPartFaceTargets(part)[0]?.face;
    expect(face).toBeDefined();
    const tangent = getPerpendicularUnit(face!.normal);
    const tangentOffset = scaleVector(tangent, 0.24);

    const extruded = extrudeAuthoredPrimitive(part, face!, {
      uuid: "connected-face",
      distance: 0.15,
    });
    const moved = {
      ...extruded,
      extrusions: [
        {
          ...extruded.extrusions[0],
          position: tangentOffset,
          rotation: [0, 0, 0.25] as [number, number, number],
          scale: [0.5, 0.75] as [number, number],
        },
      ],
    };

    const before = averageFaceCenter(
      getAuthoredPartFaceTargets(extruded).filter(
        (target) => target.face.sourceId === "extrusion:connected-face",
      ),
    );
    const after = averageFaceCenter(
      getAuthoredPartFaceTargets(moved).filter(
        (target) => target.face.sourceId === "extrusion:connected-face",
      ),
    );

    expect(dotVector(after, tangent)).toBeGreaterThan(
      dotVector(before, tangent) + 0.05,
    );

    const sideBefore = getExtrusionSideFaces(extruded, face!.normal);
    const sideAfter = getExtrusionSideFaces(moved, face!.normal);

    expect(averageFaceProjection(sideAfter, tangent)).toBeGreaterThan(
      averageFaceProjection(sideBefore, tangent) + 0.05,
    );
  });

  it("applies selected face edits to generated part targets", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const face = getAuthoredPartFaceTargets(part)[0]?.face;
    expect(face).toBeDefined();

    const edited = upsertAuthoredFaceEdit(part, face!, {
      position: [0.1, 0.2, 0.3],
    });
    const editedFace = getAuthoredPartFaceTargets(edited).find(
      (target) => getAuthoredFaceKey(target.face) === getAuthoredFaceKey(face!),
    )?.face;

    expect(editedFace?.center[0]).toBeCloseTo(face!.center[0] + 0.1);
    expect(editedFace?.center[1]).toBeCloseTo(face!.center[1] + 0.2);
    expect(editedFace?.center[2]).toBeCloseTo(face!.center[2] + 0.3);
  });

  it("keeps neighboring vertices connected for connected face edits", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const targets = getAuthoredPartFaceTargets(part, { applyEdits: false });
    const face = targets[0]?.face;
    expect(face).toBeDefined();
    const neighbor = findSharedVertexNeighbor(targets, face!);
    expect(neighbor).toBeDefined();

    const edited = upsertAuthoredFaceEdit(part, face!, {
      mode: "connected",
      position: [0.2, 0.3, 0.1],
    });
    const editedNeighbor = getAuthoredPartFaceTargets(edited).find(
      (target) =>
        getAuthoredFaceKey(target.face) ===
        getAuthoredFaceKey(neighbor!.face),
    )?.face;

    expect(editedNeighbor?.center[0]).not.toBeCloseTo(neighbor!.face.center[0]);
    expect(editedNeighbor?.center[1]).not.toBeCloseTo(neighbor!.face.center[1]);
    expect(editedNeighbor?.center[2]).not.toBeCloseTo(neighbor!.face.center[2]);
  });

  it("keeps old detached face edits from moving neighboring vertices", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const targets = getAuthoredPartFaceTargets(part, { applyEdits: false });
    const face = targets[0]?.face;
    expect(face).toBeDefined();
    const neighbor = findSharedVertexNeighbor(targets, face!);
    expect(neighbor).toBeDefined();

    const edited = upsertAuthoredFaceEdit(part, face!, {
      mode: "detached",
      position: [0.2, 0.3, 0.1],
    });
    const editedNeighbor = getAuthoredPartFaceTargets(edited).find(
      (target) =>
        getAuthoredFaceKey(target.face) ===
        getAuthoredFaceKey(neighbor!.face),
    )?.face;

    expect(editedNeighbor?.center).toEqual(neighbor!.face.center);
  });

  it("extracts deterministic component topology from primitives", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const topology = getAuthoredPartTopology(recipe.parts["part-root"]);

    expect(topology.faces).toHaveLength(6);
    expect(topology.vertices).toHaveLength(8);
    expect(topology.edges).toHaveLength(12);
    expect(topology.vertices.map((vertex) => vertex.key)).toEqual(
      [...topology.vertices.map((vertex) => vertex.key)].sort(),
    );
  });

  it("includes extruded caps and side faces in component topology", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "cone-prop",
      primitive: "cone",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const face = getAuthoredPartFaceTargets(part)[0]?.face;
    expect(face).toBeDefined();

    const extruded = extrudeAuthoredPrimitive(part, face!, {
      uuid: "extrude-topology",
      distance: 0.25,
    });
    const topology = getAuthoredPartTopology(extruded);

    expect(
      topology.faces.some((target) =>
        target.face.sourceId?.startsWith("extrusion:extrude-topology"),
      ),
    ).toBe(true);
    expect(topology.edges.length).toBeGreaterThan(0);
    expect(topology.vertices.length).toBeGreaterThan(0);
  });

  it("moves connected triangles when editing a topology vertex", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const topology = getAuthoredPartTopology(part);
    const vertex = topology.vertices[0];

    const edited = {
      ...part,
      vertexEdits: [{ vertexKey: vertex.key, offset: [0.2, 0.1, 0.05] }],
    };
    const editedTopology = getAuthoredPartTopology(edited);
    const editedVertex = editedTopology.vertices.find(
      (candidate) => candidate.key === vertex.key,
    );

    expect(editedVertex).toBeDefined();
    expect(editedVertex?.position).toEqual(
      addVector(vertex.position, [0.2, 0.1, 0.05]),
    );
    for (const faceKey of vertex.faceKeys) {
      const face = editedTopology.faces.find((candidate) =>
        candidate.key === faceKey,
      );
      expect(face?.key).toBeDefined();
      expect(face?.vertexKeys).toContain(vertex.key);
      expect(faceKey).toBeTruthy();
    }
  });

  it("keeps vertex and edge keys stable after component transforms", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const topology = getAuthoredPartTopology(part);
    const edge = topology.edges[0];

    const edited = transformAuthoredComponentSelection(
      part,
      { edgeKeys: [edge.key] },
      {
        center: addVector(edge.center, [0.25, 0, 0]),
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    );
    const editedTopology = getAuthoredPartTopology(edited);

    expect(editedTopology.edges.map((candidate) => candidate.key)).toContain(
      edge.key,
    );
    for (const vertexKey of edge.vertexKeys) {
      expect(
        editedTopology.vertices.map((candidate) => candidate.key),
      ).toContain(vertexKey);
    }
  });

  it("transforms edge endpoints through vertex edits", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const edge = getAuthoredPartTopology(part).edges[0];

    const edited = transformAuthoredComponentSelection(
      part,
      { edgeKeys: [edge.key] },
      {
        center: addVector(edge.center, [0.25, 0, 0]),
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    );

    expect(edited.vertexEdits).toHaveLength(2);
    expect(edited.vertexEdits?.map((edit) => edit.vertexKey).sort()).toEqual(
      [...edge.vertexKeys].sort(),
    );
  });

  it("transforms multi-selected faces around a shared center", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const topology = getAuthoredPartTopology(part);
    const faceKeys = topology.faces.slice(0, 2).map((face) => face.key);
    const originalSelectedVertexCount = new Set(
      topology.faces
        .filter((face) => faceKeys.includes(face.key))
        .flatMap((face) => face.vertexKeys),
    ).size;
    const center = averageFaceCenter(
      topology.faces
        .filter((face) => faceKeys.includes(face.key))
        .map((face) => ({ face: face.face })),
    );

    const edited = transformAuthoredComponentSelection(
      part,
      { faceKeys },
      {
        center: addVector(center, [0, 0.2, 0]),
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    );

    expect(edited.vertexEdits).toHaveLength(originalSelectedVertexCount);
  });

  it("merges only adjacent faces into one selectable target", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const topology = getAuthoredPartTopology(part);
    const adjacentPair = getAdjacentFacePairs(topology)[0];
    expect(adjacentPair).toBeDefined();

    const merged = mergeAuthoredFaces(part, adjacentPair);
    const mergedTopology = getAuthoredPartTopology(merged);

    expect(merged.mergedFaceGroups).toHaveLength(1);
    expect(mergedTopology.faces).toHaveLength(topology.faces.length - 1);
    expect(
      mergedTopology.faces.some((face) => face.mergedGroupId === merged.mergedFaceGroups?.[0].uuid),
    ).toBe(true);

    const unmerged = unmergeAuthoredFaceGroup(
      merged,
      merged.mergedFaceGroups![0].uuid,
    );
    expect(getAuthoredPartTopology(unmerged).faces).toHaveLength(
      topology.faces.length,
    );
  });

  it("rejects non-adjacent face merges", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const topology = getAuthoredPartTopology(part);
    const adjacent = new Set(
      getAdjacentFacePairs(topology).map((pair) => pair.sort().join("|")),
    );
    const nonAdjacentPair = topology.faces
      .flatMap((first, firstIndex) =>
        topology.faces.slice(firstIndex + 1).map((second) => [
          first.key,
          second.key,
        ] as [string, string]),
      )
      .find((pair) => !adjacent.has([...pair].sort().join("|")));
    expect(nonAdjacentPair).toBeDefined();

    const rejected = mergeAuthoredFaces(part, nonAdjacentPair!);

    expect(rejected).toBe(part);
    expect(rejected.mergedFaceGroups ?? []).toHaveLength(0);
  });

  it("deletes selected faces from generated part targets", () => {
    const recipe = createPrimitiveAssetRecipe({
      uuid: "box-prop",
      primitive: "box",
      now: 1,
    });
    const part = recipe.parts["part-root"];
    const targets = getAuthoredPartFaceTargets(part);
    const face = targets[0]?.face;
    expect(face).toBeDefined();

    const edited = upsertAuthoredFaceEdit(part, face!, {
      position: [0.1, 0, 0],
    });
    const deleted = deleteAuthoredFace(edited, face!);

    expect(deleted.deletedFaceKeys).toContain(getAuthoredFaceKey(face!));
    expect(deleted.faceEdits).toHaveLength(0);
    expect(getAuthoredPartFaceTargets(deleted)).toHaveLength(
      targets.length - 1,
    );
  });

  it("mirrors part transforms into the paired side", () => {
    const recipe = createDefaultHumanoidRecipe({
      uuid: "recipe-a",
      now: 1,
    });
    const left = createAuthoredPart({
      uuid: "part-hand-l",
      name: "Left hand",
      boneId: "hand-l",
      primitive: "cube",
      swatchId: "swatch-skin",
      color: "#c8895a",
    });
    const right = createAuthoredPart({
      uuid: "part-hand-r",
      name: "Right hand",
      boneId: "hand-r",
      primitive: "cube",
      swatchId: "swatch-skin",
      color: "#c8895a",
    });
    recipe.parts[left.uuid] = left;
    recipe.parts[right.uuid] = right;
    recipe.partOrder.push(left.uuid, right.uuid);
    recipe.parts["part-hand-l"] = {
      ...recipe.parts["part-hand-l"],
      position: [-0.2, 0.1, 0.05],
      rotation: [0.1, 0.2, 0.3],
      extrusions: [{ uuid: "e", face: "nx", distance: 0.1, scale: [1, 1] }],
    };

    const mirrored = mirrorAuthoredSelection(recipe, {
      kind: "part",
      id: "part-hand-l",
    });

    expect(mirrored.parts["part-hand-r"].position).toEqual([0.2, 0.1, 0.05]);
    expect(mirrored.parts["part-hand-r"].rotation).toEqual([0.1, -0.2, -0.3]);
    expect(mirrored.parts["part-hand-r"].extrusions[0].face).toBe("px");
  });
});

function averageFaceCenter(
  targets: ReturnType<typeof getAuthoredPartFaceTargets>,
) {
  expect(targets.length).toBeGreaterThan(0);
  return targets.reduce(
    (sum, target) => [
      sum[0] + target.face.center[0] / targets.length,
      sum[1] + target.face.center[1] / targets.length,
      sum[2] + target.face.center[2] / targets.length,
    ],
    [0, 0, 0],
  );
}

function findSharedVertexNeighbor(
  targets: ReturnType<typeof getAuthoredPartFaceTargets>,
  face: NonNullable<
    ReturnType<typeof getAuthoredPartFaceTargets>[number]
  >["face"],
) {
  const selectedKey = getAuthoredFaceKey(face);
  const selectedVertexKeys = new Set(
    face.triangles.flat().map((vertex) => vertexKey(vertex)),
  );
  return targets.find(
    (target) =>
      getAuthoredFaceKey(target.face) !== selectedKey &&
      target.face.triangles
        .flat()
        .some((vertex) => selectedVertexKeys.has(vertexKey(vertex))),
  );
}

function vertexKey(vertex: [number, number, number]) {
  return vertex.map((value) => Math.round(value * 10000) / 10000).join(",");
}

function getExtrusionSideFaces(
  part: Parameters<typeof getAuthoredPartFaceTargets>[0],
  sourceNormal: [number, number, number],
) {
  return getAuthoredPartFaceTargets(part).filter(
    (target) =>
      target.face.sourceId === "extrusion:connected-face" &&
      Math.abs(dotVector(target.face.normal, sourceNormal)) < 0.9,
  );
}

function averageFaceProjection(
  targets: ReturnType<typeof getAuthoredPartFaceTargets>,
  axis: [number, number, number],
) {
  expect(targets.length).toBeGreaterThan(0);
  return (
    targets.reduce(
      (sum, target) => sum + dotVector(target.face.center, axis),
      0,
    ) / targets.length
  );
}

function getPerpendicularUnit(vector: [number, number, number]) {
  const reference: [number, number, number] =
    Math.abs(vector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalizeVector(crossVector(vector, reference));
}

function scaleVector(
  vector: [number, number, number],
  scalar: number,
): [number, number, number] {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addVector(
  vector: [number, number, number],
  offset: [number, number, number],
): [number, number, number] {
  return [
    vector[0] + offset[0],
    vector[1] + offset[1],
    vector[2] + offset[2],
  ];
}

function normalizeVector(
  vector: [number, number, number],
): [number, number, number] {
  const length =
    Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossVector(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dotVector(
  a: [number, number, number],
  b: [number, number, number],
) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
