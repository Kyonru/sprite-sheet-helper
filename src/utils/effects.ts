import {
  EFFECT_METADATA_BY_TYPE,
  type EffectWarningKind,
} from "@/constants/effects";
import type { EffectComponent } from "@/types/effects";

export type OrderedEffectEntry = {
  uuid: string;
  effect: EffectComponent;
};

export type EffectGuidance = {
  kind: EffectWarningKind;
  title: string;
  message: string;
};

export function normalizeEffectOrder(
  effects: Record<string, EffectComponent>,
  order: string[] | undefined,
): string[] {
  const existing = new Set(Object.keys(effects));
  const next = (order ?? []).filter((uuid) => existing.has(uuid));

  for (const uuid of Object.keys(effects)) {
    if (!next.includes(uuid)) next.push(uuid);
  }

  return next;
}

export function getOrderedEffects(
  effects: Record<string, EffectComponent>,
  order: string[] | undefined,
): OrderedEffectEntry[] {
  return normalizeEffectOrder(effects, order).map((uuid) => ({
    uuid,
    effect: effects[uuid],
  }));
}

export function getEffectGuidance(
  effects: Record<string, EffectComponent>,
  order?: string[],
): EffectGuidance[] {
  const warnings = new Set<EffectWarningKind>();

  for (const { effect } of getOrderedEffects(effects, order)) {
    if (!effect.enabled) continue;

    for (const warning of EFFECT_METADATA_BY_TYPE[effect.type].warnings ?? []) {
      warnings.add(warning);
    }
  }

  const guidance: EffectGuidance[] = [
    {
      kind: "normal-map",
      title: "Normal maps stay clean",
      message:
        "Post-processing affects color captures only. Normal-map exports use the clean geometry normal pass.",
    },
  ];

  if (warnings.has("reproducibility")) {
    guidance.push({
      kind: "reproducibility",
      title: "Reproducibility risk",
      message:
        "Temporal or random-looking effects can change frame output between captures. Keep workflow golden tests in mind.",
    });
  }

  if (warnings.has("performance")) {
    guidance.push({
      kind: "performance",
      title: "Performance cost",
      message:
        "Heavy post-processing can slow capture and preview. Lower quality or disable effects while iterating.",
    });
  }

  return guidance;
}
