import { beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { DEFAULT_MODEL_DOWNGRADE_RECIPE } from "@/constants/model-downgrade";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";
import {
  analyzeModel,
  downgradeGeometry,
  downgradeModel,
  reduceAnimationClip,
} from "@/utils/model-downgrade";
import {
  clearRuntimeModel,
  setOriginalRuntimeModel,
} from "@/utils/model-downgrade-runtime";

function staticScene() {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2, 8, 8),
    new THREE.MeshStandardMaterial({ color: "#ffffff" }),
  );
  mesh.name = "StaticPlane";
  root.add(mesh);
  return { root, mesh };
}

function skinnedMesh() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0],
      3,
    ),
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0], 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  return new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: "#ffffff" }),
  );
}

describe("model downgrade utilities", () => {
  beforeEach(() => {
    useModelDowngradesStore.getState().reset();
    clearRuntimeModel("model-a");
  });

  it("analyzes model metrics", () => {
    const { root } = staticScene();
    const bone = new THREE.Bone();
    root.add(bone);
    const clip = new THREE.AnimationClip("Move", 1, [
      new THREE.VectorKeyframeTrack("StaticPlane.position", [0, 0.5, 1], [0, 0, 0, 1, 0, 0, 2, 0, 0]),
    ]);

    const analysis = analyzeModel(root, [clip]);

    expect(analysis.triangleCount).toBe(128);
    expect(analysis.meshCount).toBe(1);
    expect(analysis.staticMeshCount).toBe(1);
    expect(analysis.materialCount).toBe(1);
    expect(analysis.boneCount).toBe(1);
    expect(analysis.animationCount).toBe(1);
    expect(analysis.animationKeyframeCount).toBe(3);
  });

  it("decimates static mesh geometry and keeps the result deterministic", async () => {
    const { root } = staticScene();
    const recipe = {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      triangleBudget: 12,
      snapVertices: 0,
      removeTinyIslands: false,
    };

    const first = await downgradeModel(root, [], recipe);
    const second = await downgradeModel(root, [], recipe);

    expect(first.report.after.triangleCount).toBeLessThan(
      first.report.before.triangleCount,
    );
    expect(first.report.after.triangleCount).toBe(second.report.after.triangleCount);
  });

  it("skips topology changes for skinned meshes and keeps skin attributes", () => {
    const mesh = skinnedMesh();
    const beforeCount = mesh.geometry.getAttribute("position").count;
    const warnings: string[] = [];

    const geometry = downgradeGeometry(
      mesh,
      {
        ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
        triangleBudget: 1,
        mergeVertices: true,
        removeTinyIslands: true,
      },
      1,
      warnings,
    );

    expect(warnings.join(" ")).toContain("skinned mesh");
    expect(geometry.getAttribute("position").count).toBe(beforeCount);
    expect(geometry.getAttribute("skinIndex")).toBeDefined();
    expect(geometry.getAttribute("skinWeight")).toBeDefined();
  });

  it("quantizes vertex positions", () => {
    const mesh = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0.11, 0.24, 0.38], 3),
      ),
      new THREE.MeshBasicMaterial(),
    );

    const geometry = downgradeGeometry(
      mesh,
      {
        ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
        triangleBudget: 1,
        snapVertices: 0.25,
        flatShading: false,
        mergeVertices: false,
        removeTinyIslands: false,
      },
      1,
    );
    const position = geometry.getAttribute("position");

    expect(position.getX(0)).toBeCloseTo(0);
    expect(position.getY(0)).toBeCloseTo(0.25);
    expect(position.getZ(0)).toBeCloseTo(0.5);
  });

  it("reduces animation keyframes and supports stepped interpolation", () => {
    const clip = new THREE.AnimationClip("Move", 0.5, [
      new THREE.VectorKeyframeTrack(
        "Bone.position",
        [0, 0.1, 0.2, 0.3, 0.4, 0.5],
        [0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0, 0, 5, 0, 0],
      ),
    ]);

    const reduced = reduceAnimationClip(clip, 2, true);

    expect(reduced.tracks[0].times).toHaveLength(2);
    expect(reduced.tracks[0].getInterpolation()).toBe(
      THREE.InterpolateDiscrete,
    );
  });

  it("store previews, applies, resets, and snapshots recipes", async () => {
    const { root } = staticScene();
    setOriginalRuntimeModel("model-a", {
      object: root,
      mixer: null,
      clips: [],
    });

    useModelDowngradesStore
      .getState()
      .setRecipe("model-a", { triangleBudget: 16 });
    await useModelDowngradesStore.getState().analyze("model-a");
    await useModelDowngradesStore.getState().preview("model-a");

    expect(useModelDowngradesStore.getState().entries["model-a"].status).toBe(
      "ready",
    );
    expect(
      useModelDowngradesStore.getState().entries["model-a"].activeVariant,
    ).toBe("downgraded");

    useModelDowngradesStore.getState().reset("model-a");
    expect(
      useModelDowngradesStore.getState().entries["model-a"].activeVariant,
    ).toBe("original");
    expect(useModelDowngradesStore.getState().getSnapshot().entries["model-a"].recipe.triangleBudget).toBe(16);
  });
});
