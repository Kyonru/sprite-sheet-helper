import { beforeEach, describe, expect, it } from "vitest";
import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";

describe("entities store", () => {
  beforeEach(() => {
    useEntitiesStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("adds entities with defaults and supports select/unselect", () => {
    const uuid = useEntitiesStore
      .getState()
      .addEntity("model", "Hero", { type: "model" });

    const entity = useEntitiesStore.getState().entities[uuid];
    expect(entity).toMatchObject({
      uuid,
      type: "model",
      name: "Hero",
      visible: true,
      metadata: { type: "model" },
    });

    useEntitiesStore.getState().selectEntity(uuid);
    expect(useEntitiesStore.getState().selected).toBe(uuid);

    useEntitiesStore.getState().unselectEntity();
    expect(useEntitiesStore.getState().selected).toBeUndefined();
  });

  it("toggles visibility and ignores unknown uuids", () => {
    const uuid = useEntitiesStore.getState().addEntity("model", "Hero");

    useEntitiesStore.getState().setVisibility(uuid, false);
    expect(useEntitiesStore.getState().entities[uuid].visible).toBe(false);

    const before = useEntitiesStore.getState();
    useEntitiesStore.getState().setVisibility("missing", false);
    expect(useEntitiesStore.getState().entities).toEqual(before.entities);
  });

  it("manages children relationships", () => {
    const parent = useEntitiesStore.getState().addEntity("transform", "Group");

    useEntitiesStore.getState().setChildren(parent, ["a", "b"]);
    expect(useEntitiesStore.getState().children[parent]).toEqual({
      a: true,
      b: true,
    });

    useEntitiesStore.getState().updateChildren(parent, "c");
    expect(useEntitiesStore.getState().children[parent].c).toBe(true);

    useEntitiesStore.getState().removeChild(parent, "a");
    expect(useEntitiesStore.getState().children[parent]).toEqual({
      b: true,
      c: true,
    });
  });

  it("undoes and redoes a rename through the history store", () => {
    const uuid = useEntitiesStore.getState().addEntity("model", "Hero");
    useHistoryStore.getState().reset();

    useEntitiesStore.getState().renameEntity(uuid, "Villain");
    expect(useEntitiesStore.getState().entities[uuid].name).toBe("Villain");
    expect(useHistoryStore.getState().past).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useEntitiesStore.getState().entities[uuid].name).toBe("Hero");

    useHistoryStore.getState().redo();
    expect(useEntitiesStore.getState().entities[uuid].name).toBe("Villain");
  });

  it("merges rapid renames into a single undo step", () => {
    const uuid = useEntitiesStore.getState().addEntity("model", "Hero");
    useHistoryStore.getState().reset();

    useEntitiesStore.getState().renameEntity(uuid, "Vil");
    useEntitiesStore.getState().renameEntity(uuid, "Villain");

    expect(useHistoryStore.getState().past).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useEntitiesStore.getState().entities[uuid].name).toBe("Hero");
  });

  it("restores a removed entity on undo", () => {
    const uuid = useEntitiesStore.getState().addEntity("model", "Hero");
    useHistoryStore.getState().reset();

    useEntitiesStore.getState().removeEntity(uuid);
    expect(useEntitiesStore.getState().entities[uuid]).toBeUndefined();

    useHistoryStore.getState().undo();
    expect(useEntitiesStore.getState().entities[uuid]).toMatchObject({
      uuid,
      name: "Hero",
    });
  });

  it("round-trips state through snapshot and hydrate", () => {
    const uuid = useEntitiesStore.getState().addEntity("camera", "Main Cam");
    useEntitiesStore.getState().setChildren(uuid, ["child"]);
    useEntitiesStore.getState().selectEntity(uuid);

    const snapshot = useEntitiesStore.getState().getSnapshot();

    useEntitiesStore.getState().reset();
    expect(useEntitiesStore.getState().entities).toEqual({});

    useEntitiesStore.getState().hydrate(snapshot);
    const state = useEntitiesStore.getState();
    expect(state.entities[uuid].name).toBe("Main Cam");
    expect(state.children[uuid]).toEqual({ child: true });
    expect(state.selected).toBe(uuid);
  });
});
