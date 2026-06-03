import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  downgradeModel,
  exportDowngradedGlb,
} from "@/utils/model-downgrade";
import { DEFAULT_MODEL_DOWNGRADE_RECIPE } from "@/constants/model-downgrade";

describe("model downgrade GLB export", () => {
  it("exports a downgraded clone as binary GLB without mutating the original", async () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2, 4, 4),
      new THREE.MeshStandardMaterial({ color: "#ff0000" }),
    );
    root.add(mesh);
    const beforeTriangles = Math.floor(
      mesh.geometry.getAttribute("position").count / 3,
    );

    const downgraded = await downgradeModel(root, [], {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      triangleBudget: 4,
      snapVertices: 0,
      removeTinyIslands: false,
    });
    const glb = await exportDowngradedGlb(downgraded.object, downgraded.clips);

    expect(glb).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(glb.slice(0, 4))).toEqual(
      new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
    );
    expect(
      Math.floor(mesh.geometry.getAttribute("position").count / 3),
    ).toBe(beforeTriangles);
  });
});
