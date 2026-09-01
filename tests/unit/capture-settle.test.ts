import { describe, expect, it } from "vitest";
import { waitForStable } from "@/utils/capture-settle";

/**
 * A scripted stream of samples, one per frame, with the last value repeating
 * forever — a camera that moves for a while and then holds.
 */
function scripted(values: number[]) {
  let frame = -1;
  const waited: number[] = [];

  return {
    waited,
    sample: () => values[Math.min(Math.max(frame, 0), values.length - 1)],
    waitFrame: async () => {
      frame += 1;
      waited.push(frame);
    },
  };
}

const equals = (a: number, b: number) => a === b;

describe("waiting for the view to settle", () => {
  it("returns once the value has repeated twice", () => {
    const camera = scripted([1, 2, 3, 3, 3, 3]);

    return waitForStable({ ...camera, equals }).then((settled) => {
      expect(settled).toBe(true);
      // Two unchanged samples are enough; it does not keep polling after that.
      expect(camera.waited.length).toBeLessThan(6);
    });
  });

  it("keeps waiting while the value is still changing", async () => {
    const camera = scripted([1, 2, 3, 4, 5, 5, 5]);

    await expect(waitForStable({ ...camera, equals })).resolves.toBe(true);
    expect(camera.waited.length).toBeGreaterThan(4);
  });

  it("gives up rather than stalling a run", async () => {
    // A camera that never stops — an orbiting rig, or a scene that renders
    // something animated behind it.
    let value = 0;
    const settled = await waitForStable({
      sample: () => (value += 1),
      equals,
      waitFrame: async () => {},
      maxFrames: 5,
    });

    expect(settled).toBe(false);
  });

  it("requires the stable frames to be consecutive", async () => {
    // Values that repeat but keep moving: 1, 1, 2, 2, 3, 3 never holds for the
    // three consecutive frames this caller asks for.
    const camera = scripted([1, 1, 2, 2, 3, 3]);

    await expect(
      waitForStable({ ...camera, equals, stableFrames: 3, maxFrames: 5 }),
    ).resolves.toBe(false);
  });

  it("settles immediately for a view that was never moving", async () => {
    const camera = scripted([7]);

    await expect(waitForStable({ ...camera, equals })).resolves.toBe(true);
    expect(camera.waited.length).toBe(2);
  });
});
