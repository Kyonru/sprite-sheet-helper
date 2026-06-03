import { describe, expect, it } from "vitest";
import {
  createAuthoredPart,
  buildAuthoredModelObject,
  createDefaultHumanoidRecipe,
  exportAuthoredModelGlb,
} from "@/utils/authored-models";
import { buildMaterialInventory } from "@/utils/material-runtime";

describe("authored model integration", () => {
  it("builds a material-inventory compatible model object", () => {
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
    });
    recipe.parts[part.uuid] = part;
    recipe.partOrder.push(part.uuid);
    const { object } = buildAuthoredModelObject(recipe);

    const inventory = buildMaterialInventory(object, "model-a");

    expect(inventory.length).toBe(recipe.partOrder.length);
    expect(inventory[0].modelUuid).toBe("model-a");
    expect(inventory.some((item) => item.meshName.includes("Torso"))).toBe(
      true,
    );
  });

  it("exports authored models as GLB", async () => {
    const recipe = createDefaultHumanoidRecipe({
      uuid: "recipe-a",
      name: "Hero",
      now: 1,
    });

    const glb = await exportAuthoredModelGlb(recipe);

    expect(glb).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(glb.slice(0, 4))).toEqual(
      new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
    );
  });
});
