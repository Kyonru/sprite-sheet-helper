import { STYLE_PRESETS } from "@/constants/style-presets";
import { useCamerasStore } from "@/store/next/cameras";
import { useEffectsStore } from "@/store/next/effects";
import { useImagesStore } from "@/store/next/images";
import {
  createMaterialAssignmentId,
  useMaterialsStore,
} from "@/store/next/materials";
import { useSettingsStore } from "@/store/next/settings";
import type { EffectComponent } from "@/types/effects";
import type { MaterialInventoryItem } from "@/types/materials";
import type { StylePresetId } from "@/types/style-presets";

export type StylePresetApplyOptions = {
  modelUuid: string;
  inventory: MaterialInventoryItem[];
  effectsMode?: "replace" | "append";
};

export type StylePresetApplyResult = {
  materialId: string;
  assignedSlots: number;
  effectCount: number;
  unsupportedTargets: string[];
};

export function applyStylePresetToModel(
  presetId: StylePresetId,
  options: StylePresetApplyOptions,
): StylePresetApplyResult {
  const preset = STYLE_PRESETS[presetId];
  const materialStore = useMaterialsStore.getState();
  const materialId = materialStore.createMaterial({
    name: preset.name,
    presetId: preset.materialPresetId,
    values: {
      ...preset.materialValues,
      textureSize: preset.targets.textureSize,
      paletteColors: preset.targets.paletteColors,
      flatShading: preset.targets.flatShading,
      nearestFiltering: preset.targets.nearestFiltering,
      dithering: preset.targets.dither,
    },
  });

  for (const item of options.inventory) {
    materialStore.setMaterialAssignment({
      modelUuid: options.modelUuid,
      meshPath: item.meshPath,
      meshName: item.meshName,
      materialSlot: item.materialSlot,
      materialId,
    });
  }

  applyCaptureTargets(presetId);
  applyRenderDefaults(presetId);
  applyEffectTargets(presetId, options.effectsMode ?? "replace");

  return {
    materialId,
    assignedSlots: options.inventory.length,
    effectCount: preset.effects.length,
    unsupportedTargets: getUnsupportedStylePresetTargets(presetId),
  };
}

export function getUnsupportedStylePresetTargets(
  presetId: StylePresetId,
): string[] {
  const targets = STYLE_PRESETS[presetId].targets;
  const unsupported: string[] = [];

  if (targets.triangleBudget) unsupported.push("triangle budget");
  if (targets.snapVertices) unsupported.push("vertex snapping");
  if (targets.affineTexture) unsupported.push("affine texture warping");
  if (targets.bakedAo) unsupported.push("baked AO");
  if (targets.lowDrawDistance) unsupported.push("low draw distance");

  return unsupported;
}

export function getStylePresetAssignmentIds(
  modelUuid: string,
  inventory: MaterialInventoryItem[],
) {
  return inventory.map((item) =>
    createMaterialAssignmentId(modelUuid, item.meshPath, item.materialSlot),
  );
}

function applyCaptureTargets(presetId: StylePresetId) {
  const fps = STYLE_PRESETS[presetId].targets.animationFps;
  const frameMs = Math.max(1, Math.round(1000 / fps));
  const images = useImagesStore.getState();
  images.setIntervals(frameMs);
  images.setFPS(frameMs);
}

function applyRenderDefaults(presetId: StylePresetId) {
  const defaults = STYLE_PRESETS[presetId].renderDefaults;
  const settings = useSettingsStore.getState();
  settings.update({
    width: defaults.width ?? settings.width,
    height: defaults.height ?? settings.height,
    exportWidth: defaults.exportWidth ?? settings.exportWidth,
    exportHeight: defaults.exportHeight ?? settings.exportHeight,
    cameraDistance: defaults.cameraDistance ?? settings.cameraDistance,
  });

  const cameras = useCamerasStore.getState();
  if (defaults.cameraType && cameras.mainCamera) {
    cameras.setCameraType(cameras.mainCamera, defaults.cameraType);
  }
}

function applyEffectTargets(
  presetId: StylePresetId,
  mode: "replace" | "append",
) {
  const preset = STYLE_PRESETS[presetId];
  const effects = useEffectsStore.getState();
  if (mode === "replace") effects.clearEffects();
  for (const entry of preset.effects) {
    effects.initEffect(
      entry.type,
      entry.props as Partial<EffectComponent> | undefined,
    );
  }
}
