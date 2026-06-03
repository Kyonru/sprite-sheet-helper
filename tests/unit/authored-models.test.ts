import { describe, expect, it } from "vitest";
import {
  buildAuthoredModelObject,
  createAuthoredPart,
  createDefaultHumanoidRecipe,
  createPrimitiveAssetRecipe,
  extrudeAuthoredPrimitive,
  mirrorAuthoredSelection,
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
