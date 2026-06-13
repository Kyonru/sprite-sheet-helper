import { create } from "zustand";
import type {
  ColorAdjustEffect,
  DropShadowEffect,
  GlowEffect,
  OuterOutlineEffect,
  SpritePostprocessEffect,
  SpritePostprocessEffectType,
  SpritePostprocessSnapshot,
} from "@/types/sprite-postprocess";

const DEFAULT_SNAPSHOT: SpritePostprocessSnapshot = {
  enabled: false,
  effects: [],
  selectedRow: 0,
  selectedFrame: 0,
  compareBeforeAfter: false,
};

function createId(type: SpritePostprocessEffectType) {
  return `${type}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function createSpritePostprocessEffect(
  type: SpritePostprocessEffectType,
): SpritePostprocessEffect {
  const base = {
    id: createId(type),
    type,
    enabled: true,
  };

  switch (type) {
    case "outerOutline":
      return {
        ...base,
        type,
        color: "#111111",
        thickness: 3,
        opacity: 1,
        outlineMode: "smooth",
      } satisfies OuterOutlineEffect;
    case "dropShadow":
      return {
        ...base,
        type,
        color: "#000000",
        offsetX: 4,
        offsetY: 6,
        blur: 4,
        spread: 1,
        opacity: 0.45,
      } satisfies DropShadowEffect;
    case "glow":
      return {
        ...base,
        type,
        color: "#80d8ff",
        radius: 6,
        opacity: 0.5,
      } satisfies GlowEffect;
    case "colorAdjust":
      return {
        ...base,
        type,
        brightness: 0,
        contrast: 0,
        saturation: 0,
      } satisfies ColorAdjustEffect;
  }
}

function normalizeSnapshot(
  snapshot?: Partial<SpritePostprocessSnapshot>,
): SpritePostprocessSnapshot {
  return {
    enabled: Boolean(snapshot?.enabled),
    effects: Array.isArray(snapshot?.effects) ? snapshot.effects : [],
    selectedRow: Number.isFinite(snapshot?.selectedRow)
      ? Math.max(0, Math.floor(snapshot?.selectedRow ?? 0))
      : 0,
    selectedFrame: Number.isFinite(snapshot?.selectedFrame)
      ? Math.max(0, Math.floor(snapshot?.selectedFrame ?? 0))
      : 0,
    compareBeforeAfter: Boolean(snapshot?.compareBeforeAfter),
  };
}

export type SpritePostprocessState = SpritePostprocessSnapshot & {
  setEnabled: (enabled: boolean) => void;
  setSelectedRow: (selectedRow: number) => void;
  setSelectedFrame: (selectedFrame: number) => void;
  setCompareBeforeAfter: (compareBeforeAfter: boolean) => void;
  addEffect: (type: SpritePostprocessEffectType) => void;
  updateEffect: (
    id: string,
    patch: Partial<SpritePostprocessEffect>,
  ) => void;
  removeEffect: (id: string) => void;
  moveEffect: (id: string, direction: -1 | 1) => void;
  reset: () => void;
  hydrate: (snapshot: Partial<SpritePostprocessSnapshot>) => void;
  getSnapshot: () => SpritePostprocessSnapshot;
};

export const useSpritePostprocessStore = create<SpritePostprocessState>()(
  (set, get) => ({
    ...DEFAULT_SNAPSHOT,
    setEnabled: (enabled) => set({ enabled }),
    setSelectedRow: (selectedRow) =>
      set({ selectedRow: Math.max(0, Math.floor(selectedRow)) }),
    setSelectedFrame: (selectedFrame) =>
      set({ selectedFrame: Math.max(0, Math.floor(selectedFrame)) }),
    setCompareBeforeAfter: (compareBeforeAfter) =>
      set({ compareBeforeAfter }),
    addEffect: (type) =>
      set((state) => ({
        enabled: true,
        effects: [...state.effects, createSpritePostprocessEffect(type)],
      })),
    updateEffect: (id, patch) =>
      set((state) => ({
        effects: state.effects.map((effect) =>
          effect.id === id ? ({ ...effect, ...patch } as SpritePostprocessEffect) : effect,
        ),
      })),
    removeEffect: (id) =>
      set((state) => ({
        effects: state.effects.filter((effect) => effect.id !== id),
      })),
    moveEffect: (id, direction) =>
      set((state) => {
        const index = state.effects.findIndex((effect) => effect.id === id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= state.effects.length) {
          return state;
        }
        const effects = [...state.effects];
        const [effect] = effects.splice(index, 1);
        effects.splice(nextIndex, 0, effect);
        return { effects };
      }),
    reset: () => set(DEFAULT_SNAPSHOT),
    hydrate: (snapshot) => set(normalizeSnapshot(snapshot)),
    getSnapshot: () => {
      const state = get();
      return {
        enabled: state.enabled,
        effects: state.effects.map((effect) => ({ ...effect })),
        selectedRow: state.selectedRow,
        selectedFrame: state.selectedFrame,
        compareBeforeAfter: state.compareBeforeAfter,
      };
    },
  }),
);
