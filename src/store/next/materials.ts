import { create } from "zustand";
import { inspector } from "@kyonru/zustand-inspector";
import {
  DEFAULT_MATERIAL_VALUES,
  DEFAULT_RETRO_TEXTURE_OPTIONS,
  MATERIAL_PRESETS,
} from "@/constants/materials";
import type {
  MaterialAsset,
  MaterialAssignment,
  MaterialInventoryItem,
  MaterialsSnapshot,
  MaterialTextureAsset,
  MaterialPresetId,
  RetroTextureOptions,
} from "@/types/materials";
import { generateUUID } from "@/utils/strings";
import {
  generateRetroTextureVariant,
  getImageFileDimensions,
} from "@/utils/material-textures";
import {
  readFileFromFS,
  saveFileToFS,
} from "@/utils/file-system/fs.web";

export type MaterialsState = MaterialsSnapshot & {
  inventories: Record<string, MaterialInventoryItem[]>;
};

type CreateMaterialOptions = {
  name?: string;
  presetId?: MaterialPresetId;
  values?: Partial<MaterialAsset>;
};

type SetMaterialAssignmentInput = {
  modelUuid: string;
  meshPath: string;
  meshName: string;
  materialSlot: number;
  materialId: string;
};

interface MaterialsActions {
  createMaterial: (options?: CreateMaterialOptions) => string;
  duplicateMaterial: (uuid: string) => string | undefined;
  updateMaterial: (uuid: string, props: Partial<MaterialAsset>) => void;
  removeMaterial: (uuid: string) => void;
  setMaterialAssignment: (input: SetMaterialAssignmentInput) => void;
  removeMaterialAssignment: (
    modelUuid: string,
    meshPath: string,
    materialSlot: number,
  ) => void;
  resetModelMaterials: (modelUuid: string) => void;
  addTextureAsset: (
    file: File,
    name?: string,
  ) => Promise<string | undefined>;
  generateTextureVariant: (
    textureId: string,
    options?: Partial<RetroTextureOptions>,
  ) => Promise<string | undefined>;
  removeTextureAsset: (uuid: string) => void;
  setModelInventory: (
    modelUuid: string,
    inventory: MaterialInventoryItem[],
  ) => void;
  setSelectedMaterial: (uuid?: string) => void;
  setSelectedAssignment: (id?: string) => void;
  hydrate: (snapshot: Partial<MaterialsSnapshot>) => void;
  getSnapshot: () => MaterialsSnapshot;
  reset: () => void;
}

const initialState: MaterialsState = {
  materials: {},
  assignments: {},
  textures: {},
  selectedMaterialId: undefined,
  selectedAssignmentId: undefined,
  inventories: {},
};

export const EMPTY_MATERIAL_INVENTORY: MaterialInventoryItem[] = [];

export type MaterialsStore = MaterialsState & MaterialsActions;

export function createMaterialAssignmentId(
  modelUuid: string,
  meshPath: string,
  materialSlot: number,
) {
  return `${modelUuid}::${meshPath}::${materialSlot}`;
}

function createMaterialAsset(options: CreateMaterialOptions = {}): MaterialAsset {
  const now = Date.now();
  const preset = options.presetId
    ? MATERIAL_PRESETS[options.presetId]
    : undefined;
  return {
    uuid: generateUUID(),
    name: options.name ?? preset?.name ?? "Material",
    createdAt: now,
    updatedAt: now,
    presetId: options.presetId,
    ...DEFAULT_MATERIAL_VALUES,
    ...(preset?.values ?? {}),
    ...(options.values ?? {}),
  };
}

export const useMaterialsStore = create<MaterialsStore>()(
  inspector(
    (set, get) => ({
      ...initialState,

      createMaterial: (options = {}) => {
        const material = createMaterialAsset(options);
        set((state) => ({
          materials: {
            ...state.materials,
            [material.uuid]: material,
          },
          selectedMaterialId: material.uuid,
        }));
        return material.uuid;
      },

      duplicateMaterial: (uuid) => {
        const source = get().materials[uuid];
        if (!source) return undefined;
        const now = Date.now();
        const material: MaterialAsset = {
          ...structuredClone(source),
          uuid: generateUUID(),
          name: `${source.name} Copy`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          materials: { ...state.materials, [material.uuid]: material },
          selectedMaterialId: material.uuid,
        }));
        return material.uuid;
      },

      updateMaterial: (uuid, props) =>
        set((state) => {
          const material = state.materials[uuid];
          if (!material) return state;
          return {
            materials: {
              ...state.materials,
              [uuid]: {
                ...material,
                ...props,
                uuid,
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeMaterial: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...materials } = state.materials;
          const assignments = Object.fromEntries(
            Object.entries(state.assignments).filter(
              ([, assignment]) => assignment.materialId !== uuid,
            ),
          );
          return {
            materials,
            assignments,
            selectedMaterialId:
              state.selectedMaterialId === uuid
                ? Object.keys(materials)[0]
                : state.selectedMaterialId,
          };
        }),

      setMaterialAssignment: (input) =>
        set((state) => {
          const id = createMaterialAssignmentId(
            input.modelUuid,
            input.meshPath,
            input.materialSlot,
          );
          const assignment: MaterialAssignment = {
            id,
            ...input,
            updatedAt: Date.now(),
          };
          return {
            assignments: { ...state.assignments, [id]: assignment },
            selectedAssignmentId: id,
            selectedMaterialId: input.materialId,
          };
        }),

      removeMaterialAssignment: (modelUuid, meshPath, materialSlot) =>
        set((state) => {
          const id = createMaterialAssignmentId(
            modelUuid,
            meshPath,
            materialSlot,
          );
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _, ...assignments } = state.assignments;
          return {
            assignments,
            selectedAssignmentId:
              state.selectedAssignmentId === id
                ? undefined
                : state.selectedAssignmentId,
          };
        }),

      resetModelMaterials: (modelUuid) =>
        set((state) => ({
          assignments: Object.fromEntries(
            Object.entries(state.assignments).filter(
              ([, assignment]) => assignment.modelUuid !== modelUuid,
            ),
          ),
          selectedAssignmentId: state.selectedAssignmentId?.startsWith(
            `${modelUuid}::`,
          )
            ? undefined
            : state.selectedAssignmentId,
        })),

      addTextureAsset: async (file, name) => {
        const uuid = generateUUID();
        const fileName = await saveFileToFS(uuid, file, "materials");
        const dimensions = await getImageFileDimensions(file);
        const texture: MaterialTextureAsset = {
          uuid,
          name: name ?? file.name,
          fileName,
          filePath: fileName,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          width: dimensions?.width,
          height: dimensions?.height,
          createdAt: Date.now(),
        };
        set((state) => ({
          textures: { ...state.textures, [uuid]: texture },
        }));
        return uuid;
      },

      generateTextureVariant: async (textureId, options = {}) => {
        const source = get().textures[textureId];
        if (!source) return undefined;
        const mergedOptions = {
          ...DEFAULT_RETRO_TEXTURE_OPTIONS,
          ...options,
        };
        const sourceFile = await readFileFromFS(source.filePath, "materials");
        const blob = await generateRetroTextureVariant(
          sourceFile,
          mergedOptions,
        );
        const file = new File(
          [blob],
          `${source.name.replace(/\.[^.]+$/, "")}-${mergedOptions.targetSize}px.png`,
          { type: "image/png" },
        );
        const uuid = generateUUID();
        const fileName = await saveFileToFS(uuid, file, "materials");
        const texture: MaterialTextureAsset = {
          uuid,
          name: `${source.name} ${mergedOptions.targetSize}px`,
          fileName,
          filePath: fileName,
          mimeType: "image/png",
          size: file.size,
          width: mergedOptions.targetSize,
          height: mergedOptions.targetSize,
          sourceTextureId: textureId,
          createdAt: Date.now(),
          generated: true,
          generation: mergedOptions,
        };
        set((state) => ({
          textures: { ...state.textures, [uuid]: texture },
        }));
        return uuid;
      },

      removeTextureAsset: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...textures } = state.textures;
          const materials = Object.fromEntries(
            Object.entries(state.materials).map(([materialId, material]) => [
              materialId,
              {
                ...material,
                textureRefs: Object.fromEntries(
                  Object.entries(material.textureRefs).filter(
                    ([, textureId]) => textureId !== uuid,
                  ),
                ),
              },
            ]),
          ) as Record<string, MaterialAsset>;
          return { textures, materials };
        }),

      setModelInventory: (modelUuid, inventory) =>
        set((state) => ({
          inventories: {
            ...state.inventories,
            [modelUuid]: inventory.map((item) => ({
              ...item,
              modelUuid,
            })),
          },
        })),

      setSelectedMaterial: (uuid) =>
        set((state) => ({
          selectedMaterialId: uuid && state.materials[uuid] ? uuid : undefined,
        })),

      setSelectedAssignment: (id) =>
        set((state) => ({
          selectedAssignmentId: id,
          selectedMaterialId:
            id && state.assignments[id]
              ? state.assignments[id].materialId
              : state.selectedMaterialId,
        })),

      hydrate: (snapshot) => {
        set({
          ...initialState,
          materials: snapshot.materials ?? {},
          assignments: snapshot.assignments ?? {},
          textures: snapshot.textures ?? {},
          selectedMaterialId: snapshot.selectedMaterialId,
          selectedAssignmentId: snapshot.selectedAssignmentId,
        });
      },

      getSnapshot: () => {
        const { materials, assignments, textures } = get();
        return {
          materials,
          assignments,
          textures,
          selectedMaterialId: get().selectedMaterialId,
          selectedAssignmentId: get().selectedAssignmentId,
        };
      },

      reset: () => set({ ...initialState }),
    }),
    { name: "Materials", enabled: import.meta.env.DEV },
  ),
);

export const useMaterial = (uuid?: string) =>
  useMaterialsStore((state) =>
    uuid ? state.materials[uuid] : undefined,
  );
