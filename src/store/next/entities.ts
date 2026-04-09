import type { Entity, ObjectType, SnapshotEnabledStore } from "@/types/ecs";
import { generateUUID } from "@/utils/strings";
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import { withHistory } from "../common/middlewares/history";
import { isEqual } from "@/utils/object";

export interface EntitiesState {
  entities: Record<string, Entity>;
  children: Record<string, Record<string, boolean>>;
  selected?: string;
}

interface EntitiesActions extends SnapshotEnabledStore<EntitiesState> {
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
}

const initialState: EntitiesState = {
  entities: {},
  children: {},
};

export const useEntitiesStore = create<EntitiesState & EntitiesActions>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

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
              [uuid]: Object.fromEntries(
                children.map((child) => [child, true]),
              ),
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

        reset: () => set(initialState),

        hydrate: (snapshot) =>
          set({
            entities: snapshot.entities,
            children: snapshot.children,
            selected: snapshot.selected,
          }),

        getSnapshot: () => {
          return {
            entities: get().entities,
            children: get().children,
            selected: get().selected,
          };
        },
      }),
      {
        name: "Entities",
        watchers: [
          {
            select: (state) => ({
              entities: state.entities,
              children: state.children,
            }),

            toAction: (prev, next, api) => {
              const prevEntities = prev.entities;
              const nextEntities = next.entities;

              const prevKeys = new Set(Object.keys(prevEntities));
              const nextKeys = new Set(Object.keys(nextEntities));

              // Add
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  // Since entity is init in batch, we don't need to init it here
                  return null;
                }
              }

              // Remove
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "entity/remove",
                    uuid,
                    from: prevEntities[uuid],
                    to: null,

                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeEntity(uuid);
                      } else {
                        api.getState().restoreEntity(value);
                      }
                    },
                  };
                }
              }

              // Rename (entity-level change)
              for (const uuid of nextKeys) {
                const p = prevEntities[uuid];
                const n = nextEntities[uuid];

                if (p !== n) {
                  if (p.name !== n.name) {
                    return {
                      type: "entity/rename",
                      uuid,
                      from: p.name,
                      to: n.name,

                      apply: ({ value }) => {
                        api.getState().renameEntity(uuid, value);
                      },
                    };
                  }

                  if (!isEqual(p, n)) {
                    return null;
                  }
                }
              }

              // Children change (structure)
              const prevChildren = prev.children || {};
              const nextChildren = next.children || {};

              const allParents = new Set([
                ...Object.keys(prevChildren),
                ...Object.keys(nextChildren),
              ]);

              for (const uuid of allParents) {
                const p = Object.keys(prevChildren[uuid] || {});
                const n = Object.keys(nextChildren[uuid] || {});

                if (!isEqual(p, n)) {
                  return {
                    type: "entity/children",
                    uuid,
                    from: p,
                    to: n,

                    apply: ({ value }) => {
                      api.getState().setChildren(uuid, value);
                    },
                  };
                }
              }

              return null;
            },

            mergeKey: (prev, next) => {
              const prevEntities = prev.entities;
              const nextEntities = next.entities;

              for (const uuid of Object.keys(nextEntities)) {
                const p = prevEntities[uuid];
                const n = nextEntities[uuid];

                if (p !== n) {
                  if (p.name !== n.name) {
                    return `entity:${uuid}:rename`;
                  }
                }
              }

              return undefined;
            },
          },
        ],
      },
    ),
    { name: "Entities" },
  ),
);

export const useEntitiesByType = (type: ObjectType) =>
  useEntitiesStore((state) =>
    Object.values(state.entities).filter((e) => e.type === type),
  );

export const useEntity = (uuid?: string) =>
  useEntitiesStore((state) => (uuid ? state.entities[uuid] : undefined));
