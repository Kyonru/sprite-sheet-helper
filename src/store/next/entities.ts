import type { Entity, ObjectType } from "@/types/ecs";
import { generateUUID } from "@/utils/strings";
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";

interface EntitiesState {
  entities: Record<string, Entity>;
  children: Record<string, Record<string, boolean>>;
  selected?: string;
}

interface EntitiesActions {
  addEntity: (
    type: ObjectType,
    name: string,
    metadata?: Record<string, unknown>,
  ) => string;
  removeEntity: (uuid: string) => void;
  renameEntity: (uuid: string, name: string) => void;
  restoreEntity: (entity: Entity) => void;
  setVisibility: (uuid: string, visible: boolean) => void;
  updateChildren: (uuid: string, child: string) => void;
  setChildren: (uuid: string, children: string[]) => void;
  removeChild: (uuid: string, child: string) => void;
  selectEntity: (uuid?: string) => void;
  unselectEntity: () => void;
  hydrate: (
    entities: Record<string, Entity>,
    children: Record<string, Record<string, boolean>>,
  ) => void;
}

export const useEntitiesStore = create<EntitiesState & EntitiesActions>()(
  inspector(
    (set) => ({
      entities: {},
      children: {},

      addEntity: (type, name, metadata: Record<string, unknown> = {}) => {
        const uuid = generateUUID();
        set((state) => ({
          entities: {
            ...state.entities,
            [uuid]: {
              uuid,
              type,
              name,
              createdAt: Date.now(),
              metadata: metadata,
            },
          },
        }));
        return uuid;
      },

      removeEntity: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.entities;
          const children = state.children;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: __, ...restChildren } = children ?? {};

          return {
            entities: rest,
            children: { ...(restChildren || {}) },
          };
        }),

      renameEntity: (uuid, name) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [uuid]: { ...state.entities[uuid], name },
          },
        })),

      restoreEntity: (entity: Entity) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [entity.uuid]: entity,
          },
        })),

      setVisibility: (uuid: string, visible: boolean) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [uuid]: { ...state.entities[uuid], visible },
          },
        })),

      setChildren: (uuid: string, children: string[]) =>
        set((state) => ({
          children: {
            ...state.children,
            [uuid]: Object.fromEntries(children.map((child) => [child, true])),
          },
        })),

      updateChildren: (uuid: string, child: string) =>
        set((state) => ({
          children: {
            ...state.children,
            [uuid]: {
              ...state.children[uuid],
              [child]: true,
            },
          },
        })),

      removeChild: (uuid: string, child: string) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [child]: _, ...remaining } = state.children[uuid] ?? {};
          return {
            children: { ...state.children, [uuid]: remaining },
          };
        }),

      selectEntity: (uuid?: string) => set({ selected: uuid }),

      unselectEntity: () => set({ selected: undefined }),

      hydrate: (entities, children) => set({ entities, children }),
    }),
    { name: "Entities" },
  ),
);

export const useEntitiesByType = (type: ObjectType) =>
  useEntitiesStore((state) =>
    Object.values(state.entities).filter((e) => e.type === type),
  );

export const useEntity = (uuid?: string) =>
  useEntitiesStore((state) => (uuid ? state.entities[uuid] : undefined));
