import { create } from "zustand";
import { inspector } from "@kyonru/zustand-inspector";
import {
  DEFAULT_MODEL_DOWNGRADE_RECIPE,
  MODEL_DOWNGRADE_PRESETS,
} from "@/constants/model-downgrade";
import type {
  ModelDowngradeEntry,
  ModelDowngradeRecipe,
  ModelDowngradesState,
  ModelDowngradeVariant,
} from "@/types/model-downgrade";
import {
  analyzeModel,
  downgradeModel,
} from "@/utils/model-downgrade";
import {
  clearDowngradedRuntimeModel,
  createRuntimeFromObject,
  getOriginalRuntimeModel,
  getDowngradedRuntimeModel,
  setDowngradedRuntimeModel,
} from "@/utils/model-downgrade-runtime";

type ModelDowngradesActions = {
  setRecipe: (modelUuid: string, recipe: Partial<ModelDowngradeRecipe>) => void;
  analyze: (modelUuid: string) => Promise<void>;
  preview: (modelUuid: string) => Promise<void>;
  apply: (modelUuid: string) => Promise<boolean>;
  reset: (modelUuid?: string) => void;
  setActiveVariant: (
    modelUuid: string,
    activeVariant: ModelDowngradeVariant,
  ) => void;
  hydrate: (snapshot: ModelDowngradesState) => void;
  getSnapshot: () => ModelDowngradesState;
};

const initialState: ModelDowngradesState = {
  entries: {},
  selectedPresetId: "ps1-character",
};

export type ModelDowngradesStore = ModelDowngradesState &
  ModelDowngradesActions;

export const useModelDowngradesStore = create<ModelDowngradesStore>()(
  inspector(
    (set, get) => ({
      ...initialState,

      setRecipe: (modelUuid, recipe) =>
        set((state) => {
          clearDowngradedRuntimeModel(modelUuid);
          const current = getEntry(state.entries[modelUuid]);
          const nextRecipe = recipe.presetId
            ? {
                ...MODEL_DOWNGRADE_PRESETS[recipe.presetId].recipe,
                ...recipe,
              }
            : {
                ...current.recipe,
                ...recipe,
              };
          return {
            selectedPresetId: recipe.presetId ?? state.selectedPresetId,
            entries: {
              ...state.entries,
              [modelUuid]: {
                ...current,
                recipe: nextRecipe,
                report: undefined,
                activeVariant: "original",
                status: "idle",
                errorMessage: undefined,
                revision: current.revision + 1,
              },
            },
          };
        }),

      analyze: async (modelUuid) => {
        const runtime = getOriginalRuntimeModel(modelUuid);
        if (!runtime) {
          setEntryError(set, get(), modelUuid, "Model is not loaded yet.");
          return;
        }

        setEntryStatus(set, get(), modelUuid, "analyzing");
        const analysis = analyzeModel(
          runtime.object,
          runtime.clips.map(({ clip }) => clip),
        );
        set((state) => {
          const current = getEntry(state.entries[modelUuid]);
          return {
            entries: {
              ...state.entries,
              [modelUuid]: {
                ...current,
                analysis,
                status: "idle",
                errorMessage: undefined,
                revision: current.revision + 1,
              },
            },
          };
        });
      },

      preview: async (modelUuid) => {
        const runtime = getOriginalRuntimeModel(modelUuid);
        if (!runtime) {
          setEntryError(set, get(), modelUuid, "Model is not loaded yet.");
          return;
        }

        setEntryStatus(set, get(), modelUuid, "previewing");
        try {
          const entry = getEntry(get().entries[modelUuid]);
          const result = await downgradeModel(
            runtime.object,
            runtime.clips.map(({ clip }) => clip),
            entry.recipe,
          );
          setDowngradedRuntimeModel(
            modelUuid,
            createRuntimeFromObject(result.object, result.clips),
          );
          set((state) => {
            const current = getEntry(state.entries[modelUuid]);
            return {
              entries: {
                ...state.entries,
                [modelUuid]: {
                  ...current,
                  analysis: result.report.before,
                  report: result.report,
                  activeVariant: "downgraded",
                  status: "ready",
                  errorMessage: undefined,
                  revision: current.revision + 1,
                },
              },
            };
          });
        } catch (error) {
          setEntryError(
            set,
            get(),
            modelUuid,
            error instanceof Error ? error.message : "Downgrade failed.",
          );
        }
      },

      apply: async (modelUuid) => {
        if (!getDowngradedRuntimeModel(modelUuid)) {
          await get().preview(modelUuid);
        }
        if (!getDowngradedRuntimeModel(modelUuid)) return false;
        set((state) => {
          const current = getEntry(state.entries[modelUuid]);
          return {
            entries: {
              ...state.entries,
              [modelUuid]: {
                ...current,
                activeVariant: "downgraded",
                status: current.report ? "ready" : current.status,
                revision: current.revision + 1,
              },
            },
          };
        });
        return true;
      },

      reset: (modelUuid?: string) => {
        if (!modelUuid) {
          set({ ...initialState });
          return;
        }
        clearDowngradedRuntimeModel(modelUuid);
        set((state) => {
          const current = getEntry(state.entries[modelUuid]);
          return {
            entries: {
              ...state.entries,
              [modelUuid]: {
                ...current,
                activeVariant: "original",
                status: "idle",
                errorMessage: undefined,
                revision: current.revision + 1,
              },
            },
          };
        });
      },

      setActiveVariant: (modelUuid, activeVariant) =>
        set((state) => {
          const current = getEntry(state.entries[modelUuid]);
          return {
            entries: {
              ...state.entries,
              [modelUuid]: {
                ...current,
                activeVariant,
                revision: current.revision + 1,
              },
            },
          };
        }),

      hydrate: (snapshot) =>
        set({
          selectedPresetId: snapshot.selectedPresetId ?? "ps1-character",
          entries: Object.fromEntries(
            Object.entries(snapshot.entries ?? {}).map(([uuid, entry]) => [
              uuid,
              {
                ...getEntry(entry),
                ...entry,
                status: "idle",
                errorMessage: undefined,
                revision: 0,
              },
            ]),
          ),
        }),

      getSnapshot: () => ({
        selectedPresetId: get().selectedPresetId,
        entries: Object.fromEntries(
          Object.entries(get().entries).map(([uuid, entry]) => [
            uuid,
            {
              ...entry,
              status: "idle",
              errorMessage: undefined,
              revision: 0,
            },
          ]),
        ),
      }),
    }),
    { name: "Model Downgrades", enabled: import.meta.env.DEV },
  ),
);

function getEntry(entry?: Partial<ModelDowngradeEntry>): ModelDowngradeEntry {
  return {
    recipe: {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      ...(entry?.recipe ?? {}),
    },
    activeVariant: entry?.activeVariant ?? "original",
    analysis: entry?.analysis,
    report: entry?.report,
    status: entry?.status ?? "idle",
    errorMessage: entry?.errorMessage,
    revision: entry?.revision ?? 0,
  };
}

function setEntryStatus(
  set: typeof useModelDowngradesStore.setState,
  state: ModelDowngradesStore,
  modelUuid: string,
  status: ModelDowngradeEntry["status"],
) {
  const current = getEntry(state.entries[modelUuid]);
  set({
    entries: {
      ...state.entries,
      [modelUuid]: {
        ...current,
        status,
        errorMessage: undefined,
      },
    },
  });
}

function setEntryError(
  set: typeof useModelDowngradesStore.setState,
  state: ModelDowngradesStore,
  modelUuid: string,
  errorMessage: string,
) {
  const current = getEntry(state.entries[modelUuid]);
  set({
    entries: {
      ...state.entries,
      [modelUuid]: {
        ...current,
        status: "error",
        errorMessage,
        revision: current.revision + 1,
      },
    },
  });
}
