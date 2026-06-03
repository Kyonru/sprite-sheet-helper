import { beforeEach, describe, expect, it } from "vitest";
import { STYLE_PRESETS } from "@/constants/style-presets";
import { useCamerasStore } from "@/store/next/cameras";
import { useEffectsStore } from "@/store/next/effects";
import { useImagesStore } from "@/store/next/images";
import {
  createMaterialAssignmentId,
  useMaterialsStore,
} from "@/store/next/materials";
import { useSettingsStore } from "@/store/next/settings";
import type { MaterialInventoryItem } from "@/types/materials";
import {
  applyStylePresetToModel,
  getUnsupportedStylePresetTargets,
} from "@/utils/style-presets";

const inventory: MaterialInventoryItem[] = [
  {
    id: "slot-body",
    modelUuid: "model-a",
    meshPath: "Root[0]/Body[0]",
    meshName: "Body",
    materialSlot: 0,
    originalMaterialName: "Imported Body",
    original: {
      name: "Imported Body",
      color: "#ffffff",
      opacity: 1,
      transparent: false,
      side: "front",
      depthWrite: true,
      flatShading: false,
      hasTextures: {},
    },
  },
  {
    id: "slot-head",
    modelUuid: "model-a",
    meshPath: "Root[0]/Head[1]",
    meshName: "Head",
    materialSlot: 1,
    originalMaterialName: "Imported Head",
    original: {
      name: "Imported Head",
      color: "#ffffff",
      opacity: 1,
      transparent: false,
      side: "front",
      depthWrite: true,
      flatShading: false,
      hasTextures: {},
    },
  },
];

describe("style presets", () => {
  beforeEach(() => {
    useMaterialsStore.getState().reset();
    useImagesStore.getState().reset();
    useSettingsStore.getState().reset();
    useEffectsStore.getState().reset();
    useCamerasStore.getState().reset();
  });

  it("defines production targets for the requested recipes", () => {
    expect(Object.keys(STYLE_PRESETS)).toEqual([
      "ps1-character",
      "low-poly-clean",
      "pixel-art-3d",
      "retro-horror",
    ]);

    expect(STYLE_PRESETS["ps1-character"].targets).toEqual(
      expect.objectContaining({
        triangleBudget: 800,
        textureSize: 128,
        paletteColors: 32,
        flatShading: true,
        snapVertices: 0.025,
        animationFps: 10,
      }),
    );
  });

  it("applies a style preset to material slots and capture/render settings", () => {
    useCamerasStore.getState().initCamera("camera-a");
    useCamerasStore.getState().setActiveCamera("camera-a");

    const result = applyStylePresetToModel("ps1-character", {
      modelUuid: "model-a",
      inventory,
    });

    expect(result.assignedSlots).toBe(2);
    expect(result.unsupportedTargets).toEqual([
      "triangle budget",
      "vertex snapping",
      "affine texture warping",
    ]);

    const material = useMaterialsStore.getState().materials[result.materialId];
    expect(material.name).toBe("PS1 Character");
    expect(material.textureSize).toBe(128);
    expect(material.paletteColors).toBe(32);
    expect(material.nearestFiltering).toBe(true);
    expect(material.flatShading).toBe(true);

    for (const item of inventory) {
      const id = createMaterialAssignmentId(
        "model-a",
        item.meshPath,
        item.materialSlot,
      );
      expect(useMaterialsStore.getState().assignments[id].materialId).toBe(
        result.materialId,
      );
    }

    expect(useImagesStore.getState().intervals).toBe(100);
    expect(useImagesStore.getState().fps).toBe(100);
    expect(useSettingsStore.getState()).toEqual(
      expect.objectContaining({
        width: 128,
        height: 128,
        exportWidth: 64,
        exportHeight: 64,
        cameraDistance: 4,
      }),
    );
    expect(useCamerasStore.getState().cameras["camera-a"].type).toBe(
      "perspective",
    );

    const effects = useEffectsStore.getState();
    expect(effects.order.map((uuid) => effects.effects[uuid].type)).toEqual([
      "pixelation",
      "colorDepth",
      "dither",
      "gammaCorrection",
    ]);
  });

  it("replaces or appends effect stacks based on the application mode", () => {
    useEffectsStore.getState().initEffect("bloom");

    applyStylePresetToModel("pixel-art-3d", {
      modelUuid: "model-a",
      inventory,
      effectsMode: "append",
    });

    let effects = useEffectsStore.getState();
    expect(effects.order.map((uuid) => effects.effects[uuid].type)).toEqual([
      "bloom",
      "pixelation",
      "colorDepth",
      "gammaCorrection",
    ]);

    applyStylePresetToModel("low-poly-clean", {
      modelUuid: "model-a",
      inventory,
      effectsMode: "replace",
    });

    effects = useEffectsStore.getState();
    expect(effects.order.map((uuid) => effects.effects[uuid].type)).toEqual([
      "brightnessContrast",
      "gammaCorrection",
    ]);
  });

  it("reports unsupported pipeline-only targets", () => {
    expect(getUnsupportedStylePresetTargets("low-poly-clean")).toEqual([
      "triangle budget",
      "baked AO",
    ]);
    expect(getUnsupportedStylePresetTargets("pixel-art-3d")).toEqual([]);
  });
});
