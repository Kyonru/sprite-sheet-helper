import { beforeEach, describe, expect, it } from "vitest";
import { useImagesStore } from "@/store/next/images";
import { frame } from "../helpers/export-fixtures";

describe("images store normal frame alignment", () => {
  beforeEach(() => {
    useImagesStore.getState().reset();
  });

  it("stores normal frames beside captured color frames for new rows", () => {
    useImagesStore
      .getState()
      .addImagesRow("walk-id", "walk", [frame("c0")], [frame("n0")], 16, 12, 8);

    expect(useImagesStore.getState().images[0]).toMatchObject({
      uuid: "walk-id",
      label: "walk",
      images: [frame("c0")],
      normalImages: [frame("n0")],
      frameWidth: 16,
      frameHeight: 12,
      fps: 8,
    });
  });

  it("stores workflow metadata for captured rows", () => {
    const metadata = {
      workflow: {
        workflowId: "topdown-4dir",
        workflowLabel: "Top Down 4-directional",
        modelUuid: "model-a",
        animationName: "walk",
        directionLabel: "N",
      },
    };

    useImagesStore
      .getState()
      .addImagesRow(
        "walk-n-id",
        "walk_N",
        [frame("c0")],
        undefined,
        16,
        12,
        8,
        metadata,
      );

    expect(useImagesStore.getState().images[0].metadata).toEqual(metadata);
  });

  it("keeps later normal captures at their matching frame index", () => {
    const store = useImagesStore.getState();
    store.addImagesRow("walk-id", "walk", [frame("c0")], [frame("n0")], 16, 12, 8);
    store.addImageToRow(0, frame("c1"), undefined, 16, 12, 8);
    store.addImageToRow(0, frame("c2"), frame("n2"), 16, 12, 8);

    const row = useImagesStore.getState().images[0];

    expect(row.images).toEqual([frame("c0"), frame("c1"), frame("c2")]);
    expect(row.normalImages).toHaveLength(3);
    expect(row.normalImages?.[0]).toBe(frame("n0"));
    expect(row.normalImages?.[1]).toBeUndefined();
    expect(row.normalImages?.[2]).toBe(frame("n2"));
  });

  it("removes normal frames without compacting sparse indexes", () => {
    const store = useImagesStore.getState();
    store.addImagesRow("walk-id", "walk", [frame("c0")], [frame("n0")], 16, 12, 8);
    store.addImageToRow(0, frame("c1"), undefined, 16, 12, 8);
    store.addImageToRow(0, frame("c2"), frame("n2"), 16, 12, 8);
    store.removeImageFromRow(0, 1);

    const row = useImagesStore.getState().images[0];

    expect(row.images).toEqual([frame("c0"), frame("c2")]);
    expect(row.normalImages).toHaveLength(2);
    expect(row.normalImages?.[0]).toBe(frame("n0"));
    expect(row.normalImages?.[1]).toBe(frame("n2"));
  });

  it("updates and resets rows", () => {
    const store = useImagesStore.getState();
    store.addImagesRow("walk-id", "walk", [frame("c0")], [frame("n0")], 16, 12, 8);
    store.updateImagesRow(
      0,
      [frame("updated-c0"), frame("updated-c1")],
      [frame("updated-n0"), frame("updated-n1")],
    );

    expect(useImagesStore.getState().images[0]).toMatchObject({
      images: [frame("updated-c0"), frame("updated-c1")],
      normalImages: [frame("updated-n0"), frame("updated-n1")],
    });

    store.reset();

    expect(useImagesStore.getState().images).toEqual([]);
  });

  it("preserves normal frame alignment when frames are reordered", () => {
    const store = useImagesStore.getState();
    const normalImages = new Array<string>(3);
    normalImages[0] = frame("n0");
    normalImages[2] = frame("n2");

    store.addImagesRow(
      "walk-id",
      "walk",
      [frame("c0"), frame("c1"), frame("c2")],
      normalImages,
      16,
      12,
      8,
    );

    const row = useImagesStore.getState().images[0];
    const order = [2, 0, 1];
    store.updateImagesRow(
      0,
      order.map((index) => row.images[index]),
      row.normalImages
        ? order.map((index) => row.normalImages![index])
        : undefined,
    );

    expect(useImagesStore.getState().images[0].images).toEqual([
      frame("c2"),
      frame("c0"),
      frame("c1"),
    ]);
    expect(useImagesStore.getState().images[0].normalImages).toEqual([
      frame("n2"),
      frame("n0"),
      undefined,
    ]);
  });
});

describe("workflow sequences", () => {
  const workflow = (animationName: string, directionLabel: string) => ({
    workflow: {
      workflowId: "topdown-4dir",
      workflowLabel: "Top Down 4-directional",
      modelUuid: "model-a",
      animationName,
      directionLabel,
    },
  });

  const addRow = (
    label: string,
    frames: string[],
    metadata?: ReturnType<typeof workflow>,
  ) =>
    useImagesStore
      .getState()
      .addImagesRow(
        `${label}-${frames.length}`,
        label,
        frames,
        undefined,
        32,
        32,
        10,
        metadata,
      );

  beforeEach(() => {
    useImagesStore.getState().setImages([]);
  });

  it("replaces the sequence a re-run re-captures", () => {
    addRow("walk_N", ["a"], workflow("walk", "N"));
    addRow("walk_N", ["b", "c"], workflow("walk", "N"));

    const rows = useImagesStore.getState().images;
    expect(rows).toHaveLength(1);
    expect(rows[0].images).toEqual(["b", "c"]);
  });

  it("keeps sequences from other steps and other workflows", () => {
    addRow("walk_N", ["a"], workflow("walk", "N"));
    addRow("walk_E", ["b"], workflow("walk", "E"));
    addRow("idle_N", ["c"], workflow("idle", "N"));

    expect(useImagesStore.getState().images).toHaveLength(3);
  });

  it("keeps the sheet the sequence was assigned to", () => {
    addRow("walk_N", ["a"], workflow("walk", "N"));
    const uuid = useImagesStore.getState().images[0].uuid;
    useImagesStore.getState().updateSheet(uuid, "hero");

    addRow("walk_N", ["b"], workflow("walk", "N"));

    const rows = useImagesStore.getState().images;
    expect(rows).toHaveLength(1);
    expect(rows[0].sheet).toBe("hero");
    expect(rows[0].images).toEqual(["b"]);
  });

  it("never replaces a hand-captured sequence", () => {
    addRow("Animation", ["a"]);
    addRow("Animation", ["b"]);

    expect(useImagesStore.getState().images).toHaveLength(2);
  });
});
