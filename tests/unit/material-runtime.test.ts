import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyMaterialAssignments,
  buildMaterialInventory,
  createMaterialAssignmentId,
} from "@/utils/material-runtime";
import type { MaterialAsset, MaterialAssignment } from "@/types/materials";

function material(color: string, name: string) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: 0.5,
    metalness: 0,
  });
}

function asset(uuid: string, color: string): MaterialAsset {
  return {
    uuid,
    name: "Override",
    createdAt: 1,
    updatedAt: 1,
    color,
    opacity: 1,
    transparent: false,
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 0,
    wireframe: false,
    side: "front",
    depthWrite: true,
    flatShading: true,
    lightingMode: "flat",
    textureRefs: {},
    nearestFiltering: true,
    textureSize: 128,
    paletteColors: 32,
    dithering: true,
  };
}

function scene() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(),
    [material("#112233", "Cloth"), material("#445566", "Armor")],
  );
  body.name = "Body";
  root.add(body);
  return { root, body };
}

describe("material runtime", () => {
  it("builds stable mesh material inventory", () => {
    const { root } = scene();
    const inventory = buildMaterialInventory(root, "model-a");

    expect(inventory).toEqual([
      expect.objectContaining({
        id: createMaterialAssignmentId("model-a", "Body[0]", 0),
        meshPath: "Body[0]",
        meshName: "Body",
        materialSlot: 0,
        originalMaterialName: "Cloth",
      }),
      expect.objectContaining({
        id: createMaterialAssignmentId("model-a", "Body[0]", 1),
        materialSlot: 1,
        originalMaterialName: "Armor",
      }),
    ]);
  });

  it("applies assignments and restores original materials", async () => {
    const { root, body } = scene();
    const inventory = buildMaterialInventory(root, "model-a");
    const materialId = "mat-red";
    const assignmentId = createMaterialAssignmentId("model-a", "Body[0]", 1);
    const assignments: Record<string, MaterialAssignment> = {
      [assignmentId]: {
        id: assignmentId,
        modelUuid: "model-a",
        meshPath: "Body[0]",
        meshName: "Body",
        materialSlot: 1,
        materialId,
        updatedAt: 1,
      },
    };

    await applyMaterialAssignments(
      root,
      "model-a",
      inventory,
      { [materialId]: asset(materialId, "#ff0000") },
      assignments,
      {},
    );

    const applied = body.material as THREE.Material[];
    expect((applied[1] as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      "ff0000",
    );

    await applyMaterialAssignments(root, "model-a", inventory, {}, {}, {});

    const restored = body.material as THREE.Material[];
    expect(
      (restored[1] as THREE.MeshStandardMaterial).color.getHexString(),
    ).toBe("445566");
  });
});
