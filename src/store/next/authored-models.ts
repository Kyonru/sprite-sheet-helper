import { create } from "zustand";
import { inspector } from "@kyonru/zustand-inspector";
import type {
  AuthoredExtrudeFace,
  AuthoredExtrudeStep,
  AuthoredFaceEdit,
  AuthoredModelRecipe,
  AuthoredModelsState,
  AuthoredPart,
  AuthoredPrimitiveKind,
  AuthoredVector3,
  AuthoredVertexEdit,
} from "@/types/authored-models";
import type { SnapshotEnabledStore } from "@/types/ecs";
import {
  AUTHORED_WORLD_BONE_ID,
  createAuthoredPart,
  createDefaultHumanoidRecipe,
  createPrimitiveAssetRecipe,
  deleteAuthoredFace,
  extrudeAuthoredPrimitive,
  mergeAuthoredFaces,
  mirrorAuthoredSelection,
  unmergeAuthoredFaceGroup,
  upsertAuthoredFaceEdit,
  updateAuthoredVertexEdits,
} from "@/utils/authored-models";

interface AuthoredModelsActions
  extends SnapshotEnabledStore<AuthoredModelsState> {
  createHumanoidRecipe: (name?: string) => string;
  createPrimitiveRecipe: (
    name?: string,
    primitive?: AuthoredPrimitiveKind,
  ) => string;
  setSelectedRecipe: (recipeId?: string) => void;
  replaceRecipe: (recipeId: string, recipe: AuthoredModelRecipe) => void;
  updateRecipe: (recipeId: string, props: Partial<AuthoredModelRecipe>) => void;
  updateBone: (
    recipeId: string,
    boneId: string,
    props: Partial<Pick<AuthoredModelRecipe["bones"][string], "position" | "rotation" | "name">>,
  ) => void;
  addPart: (
    recipeId: string,
    input: {
      name: string;
      boneId?: string;
      primitive: AuthoredPrimitiveKind;
      scale?: AuthoredVector3;
      swatchId?: string;
      color?: string;
    },
  ) => string | undefined;
  updatePart: (
    recipeId: string,
    partId: string,
    props: Partial<AuthoredPart>,
  ) => void;
  duplicatePart: (recipeId: string, partId: string) => string | undefined;
  removePart: (recipeId: string, partId: string) => void;
  selectBone: (recipeId: string, boneId?: string) => void;
  selectPart: (recipeId: string, partId?: string) => void;
  mirrorSelection: (
    recipeId: string,
    kind: "bone" | "part",
    id?: string,
  ) => void;
  extrudePart: (
    recipeId: string,
    partId: string,
    face: AuthoredExtrudeFace,
    distance: number,
    scale?: [number, number],
  ) => string | undefined;
  updateExtrusion: (
    recipeId: string,
    partId: string,
    extrusionId: string,
    props: Partial<AuthoredExtrudeStep>,
  ) => void;
  updateFaceEdit: (
    recipeId: string,
    partId: string,
    face: AuthoredExtrudeFace,
    props: Partial<Omit<AuthoredFaceEdit, "uuid" | "faceKey">>,
  ) => void;
  updateVertexEdits: (
    recipeId: string,
    partId: string,
    edits: AuthoredVertexEdit[],
  ) => void;
  mergeFaces: (recipeId: string, partId: string, faceKeys: string[]) => void;
  unmergeFaceGroup: (
    recipeId: string,
    partId: string,
    groupId: string,
  ) => void;
  deleteFace: (
    recipeId: string,
    partId: string,
    face: AuthoredExtrudeFace,
  ) => void;
  updateSwatch: (
    recipeId: string,
    swatchId: string,
    props: Partial<AuthoredModelRecipe["swatches"][string]>,
  ) => void;
  resetPose: (recipeId: string) => void;
}

const initialState: AuthoredModelsState = {
  recipes: {},
  selectedRecipeId: undefined,
};

export type AuthoredModelsStore = AuthoredModelsState & AuthoredModelsActions;

export const useAuthoredModelsStore = create<AuthoredModelsStore>()(
  inspector(
    (set, get) => ({
      ...initialState,

      createHumanoidRecipe: (name) => {
        const recipe = createDefaultHumanoidRecipe({ name });
        set((state) => ({
          recipes: { ...state.recipes, [recipe.uuid]: recipe },
          selectedRecipeId: recipe.uuid,
        }));
        return recipe.uuid;
      },

      createPrimitiveRecipe: (name, primitive = "box") => {
        const recipe = createPrimitiveAssetRecipe({ name, primitive });
        set((state) => ({
          recipes: { ...state.recipes, [recipe.uuid]: recipe },
          selectedRecipeId: recipe.uuid,
        }));
        return recipe.uuid;
      },

      setSelectedRecipe: (recipeId) => set({ selectedRecipeId: recipeId }),

      replaceRecipe: (recipeId, recipe) =>
        set((state) => {
          if (!state.recipes[recipeId]) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({ ...recipe, uuid: recipeId }),
            },
            selectedRecipeId: recipeId,
          };
        }),

      updateRecipe: (recipeId, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({ ...recipe, ...props }),
            },
          };
        }),

      updateBone: (recipeId, boneId, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const bone = recipe?.bones[boneId];
          if (!recipe || !bone) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                bones: {
                  ...recipe.bones,
                  [boneId]: { ...bone, ...props },
                },
                selectedBoneId: boneId,
              }),
            },
          };
        }),

      addPart: (recipeId, input) => {
        const recipe = get().recipes[recipeId];
        if (!recipe) return undefined;
        const swatchId = input.swatchId ?? recipe.swatchOrder[0];
        const swatch = swatchId ? recipe.swatches[swatchId] : undefined;
        const part = createAuthoredPart({
          name: input.name,
          boneId: input.boneId ?? AUTHORED_WORLD_BONE_ID,
          primitive: input.primitive,
          scale: input.scale,
          swatchId,
          color: input.color ?? swatch?.color ?? "#ffffff",
        });
        set((state) => {
          const current = state.recipes[recipeId];
          if (!current) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...current,
                parts: { ...current.parts, [part.uuid]: part },
                partOrder: [...current.partOrder, part.uuid],
                selectedPartId: part.uuid,
              }),
            },
          };
        });
        return part.uuid;
      },

      updatePart: (recipeId, partId, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: { ...part, ...props },
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      duplicatePart: (recipeId, partId) => {
        const source = get().recipes[recipeId]?.parts[partId];
        if (!source) return undefined;
        const duplicate: AuthoredPart = {
          ...structuredClone(source),
          uuid: crypto.randomUUID(),
          name: `${source.name} Copy`,
          position: [
            source.position[0] + 0.08,
            source.position[1],
            source.position[2],
          ],
        };
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe) return state;
          const index = recipe.partOrder.indexOf(partId);
          const partOrder = [...recipe.partOrder];
          partOrder.splice(index >= 0 ? index + 1 : partOrder.length, 0, duplicate.uuid);
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: { ...recipe.parts, [duplicate.uuid]: duplicate },
                partOrder,
                selectedPartId: duplicate.uuid,
              }),
            },
          };
        });
        return duplicate.uuid;
      },

      removePart: (recipeId, partId) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe?.parts[partId]) return state;
          const parts = { ...recipe.parts };
          delete parts[partId];
          const partOrder = recipe.partOrder.filter((id) => id !== partId);
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts,
                partOrder,
                selectedPartId:
                  recipe.selectedPartId === partId
                    ? partOrder[0]
                    : recipe.selectedPartId,
              }),
            },
          };
        }),

      selectBone: (recipeId, boneId) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: { ...recipe, selectedBoneId: boneId },
            },
          };
        }),

      selectPart: (recipeId, partId) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: { ...recipe, selectedPartId: partId },
            },
          };
        }),

      mirrorSelection: (recipeId, kind, id) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe || !id) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: mirrorAuthoredSelection(recipe, { kind, id }),
            },
          };
        }),

      extrudePart: (recipeId, partId, face, distance, scale = [1, 1]) => {
        const extrusionId = crypto.randomUUID();
        const currentPart = get().recipes[recipeId]?.parts[partId];
        if (!currentPart) return undefined;
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: extrudeAuthoredPrimitive(part, face, {
                    uuid: extrusionId,
                    distance,
                    scale,
                  }),
                },
                selectedPartId: partId,
              }),
            },
          };
        });
        return extrusionId;
      },

      updateExtrusion: (recipeId, partId, extrusionId, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          const extrusions = part.extrusions.map((extrusion) =>
            extrusion.uuid === extrusionId
              ? { ...extrusion, ...props }
              : extrusion,
          );
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: { ...part, extrusions },
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      updateFaceEdit: (recipeId, partId, face, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: upsertAuthoredFaceEdit(part, face, props),
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      updateVertexEdits: (recipeId, partId, edits) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: updateAuthoredVertexEdits(part, edits),
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      mergeFaces: (recipeId, partId, faceKeys) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: mergeAuthoredFaces(part, faceKeys),
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      unmergeFaceGroup: (recipeId, partId, groupId) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: unmergeAuthoredFaceGroup(part, groupId),
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      deleteFace: (recipeId, partId, face) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const part = recipe?.parts[partId];
          if (!recipe || !part) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                parts: {
                  ...recipe.parts,
                  [partId]: deleteAuthoredFace(part, face),
                },
                selectedPartId: partId,
              }),
            },
          };
        }),

      updateSwatch: (recipeId, swatchId, props) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          const swatch = recipe?.swatches[swatchId];
          if (!recipe || !swatch) return state;
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                swatches: {
                  ...recipe.swatches,
                  [swatchId]: { ...swatch, ...props },
                },
              }),
            },
          };
        }),

      resetPose: (recipeId) =>
        set((state) => {
          const recipe = state.recipes[recipeId];
          if (!recipe) return state;
          const defaults = createDefaultHumanoidRecipe({
            uuid: recipe.uuid,
            name: recipe.name,
            now: recipe.createdAt,
          });
          return {
            recipes: {
              ...state.recipes,
              [recipeId]: touch({
                ...recipe,
                bones: Object.fromEntries(
                  recipe.boneOrder.map((boneId) => [
                    boneId,
                    {
                      ...recipe.bones[boneId],
                      position:
                        defaults.bones[boneId]?.position ??
                        recipe.bones[boneId].position,
                      rotation:
                        defaults.bones[boneId]?.rotation ??
                        recipe.bones[boneId].rotation,
                    },
                  ]),
                ),
              }),
            },
          };
        }),

      reset: () => set(initialState),

      hydrate: (snapshot) =>
        set({
          recipes: snapshot.recipes ?? {},
          selectedRecipeId: snapshot.selectedRecipeId,
        }),

      getSnapshot: () => ({
        recipes: get().recipes,
        selectedRecipeId: get().selectedRecipeId,
      }),
    }),
    { name: "AuthoredModels", enabled: import.meta.env.DEV },
  ),
);

function touch<T extends AuthoredModelRecipe>(recipe: T): T {
  return { ...recipe, updatedAt: Date.now() };
}
