import { beforeEach, describe, expect, it } from "vitest";
import {
  createMaterialAssignmentId,
  useMaterialsStore,
} from "@/store/next/materials";

describe("materials store", () => {
  beforeEach(() => {
    useMaterialsStore.getState().reset();
  });

  it("creates, updates, duplicates, and removes material assets", () => {
    const first = useMaterialsStore.getState().createMaterial({
      name: "Hero Skin",
      presetId: "ps1-character",
    });

    expect(useMaterialsStore.getState().materials[first].name).toBe(
      "Hero Skin",
    );
    expect(useMaterialsStore.getState().materials[first].nearestFiltering).toBe(
      true,
    );

    useMaterialsStore.getState().updateMaterial(first, { color: "#ff0000" });
    expect(useMaterialsStore.getState().materials[first].color).toBe("#ff0000");

    const duplicate = useMaterialsStore.getState().duplicateMaterial(first)!;
    expect(duplicate).not.toBe(first);
    expect(useMaterialsStore.getState().materials[duplicate].name).toBe(
      "Hero Skin Copy",
    );

    useMaterialsStore.getState().removeMaterial(first);
    expect(useMaterialsStore.getState().materials[first]).toBeUndefined();
  });

  it("sets, removes, and resets material assignments", () => {
    const materialId = useMaterialsStore.getState().createMaterial();
    useMaterialsStore.getState().setMaterialAssignment({
      modelUuid: "model-a",
      meshPath: "Root[0]/Body[0]",
      meshName: "Body",
      materialSlot: 1,
      materialId,
    });

    const id = createMaterialAssignmentId("model-a", "Root[0]/Body[0]", 1);
    expect(useMaterialsStore.getState().assignments[id].materialId).toBe(
      materialId,
    );

    useMaterialsStore
      .getState()
      .removeMaterialAssignment("model-a", "Root[0]/Body[0]", 1);
    expect(useMaterialsStore.getState().assignments[id]).toBeUndefined();

    useMaterialsStore.getState().setMaterialAssignment({
      modelUuid: "model-a",
      meshPath: "Root[0]/Body[0]",
      meshName: "Body",
      materialSlot: 0,
      materialId,
    });
    useMaterialsStore.getState().setMaterialAssignment({
      modelUuid: "model-b",
      meshPath: "Root[0]/Body[0]",
      meshName: "Body",
      materialSlot: 0,
      materialId,
    });
    useMaterialsStore.getState().resetModelMaterials("model-a");

    expect(Object.values(useMaterialsStore.getState().assignments)).toEqual([
      expect.objectContaining({ modelUuid: "model-b" }),
    ]);
  });
});
