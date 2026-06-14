import { describe, expect, it } from "vitest";
import type { WorkflowDirection } from "@/constants/workflows";
import {
  normalizeWorkflowDegrees,
  resolveWorkflowCamera,
} from "@/utils/workflow-camera";

const direction: WorkflowDirection = {
  label: "E",
  phi: 45,
  theta: 90,
};

describe("workflow camera utilities", () => {
  it("uses workflow direction defaults when no draft options are provided", () => {
    const camera = resolveWorkflowCamera({
      direction,
      defaultDistance: 4,
      defaultTarget: [1, 2, 3],
    });

    expect(camera.phi).toBe(45);
    expect(camera.theta).toBe(90);
    expect(camera.distance).toBe(4);
    expect(camera.target).toEqual([1, 2, 3]);
    expect(camera.position[0]).toBeCloseTo(1 + Math.SQRT2 * 2);
    expect(camera.position[1]).toBeCloseTo(2 + Math.SQRT2 * 2);
    expect(camera.position[2]).toBeCloseTo(3);
  });

  it("applies a deterministic rotation offset to direction theta", () => {
    const camera = resolveWorkflowCamera({
      direction,
      defaultDistance: 4,
      defaultTarget: [0, 0, 0],
      options: {
        directionRotationOffset: 270,
      },
    });

    expect(camera.theta).toBe(0);
  });

  it("lets global draft values override persisted defaults", () => {
    const camera = resolveWorkflowCamera({
      direction,
      defaultDistance: 4,
      defaultCameraAngle: 30,
      defaultTarget: [0, 0, 0],
      options: {
        cameraDistance: 7,
        cameraAngle: 60,
        target: [2, 0, -1],
      },
    });

    expect(camera.distance).toBe(7);
    expect(camera.phi).toBe(60);
    expect(camera.target).toEqual([2, 0, -1]);
  });

  it("uses workflow distance as zoom for orthographic cameras", () => {
    const camera = resolveWorkflowCamera({
      direction,
      defaultDistance: 4,
      defaultTarget: [1, 2, 3],
      options: {
        cameraDistance: 2.5,
        cameraType: "orthographic",
      },
    });

    expect(camera.cameraType).toBe("orthographic");
    expect(camera.distance).toBe(2.5);
    expect(camera.zoom).toBe(2.5);
    expect(camera.position[0]).toBeCloseTo(1 + Math.SQRT2 * 2);
    expect(camera.position[1]).toBeCloseTo(2 + Math.SQRT2 * 2);
    expect(camera.position[2]).toBeCloseTo(3);
  });

  it("lets per-direction overrides beat global draft values", () => {
    const camera = resolveWorkflowCamera({
      direction,
      defaultDistance: 4,
      defaultCameraAngle: 30,
      defaultTarget: [0, 0, 0],
      options: {
        cameraDistance: 7,
        cameraAngle: 60,
        directionRotationOffset: 45,
        target: [2, 0, -1],
        directionOverrides: {
          E: {
            distance: 3,
            phi: 80,
            theta: 123,
            target: [4, 5, 6],
          },
        },
      },
    });

    expect(camera.distance).toBe(3);
    expect(camera.phi).toBe(80);
    expect(camera.theta).toBe(123);
    expect(camera.target).toEqual([4, 5, 6]);
  });

  it("normalizes negative and overflowing degree values", () => {
    expect(normalizeWorkflowDegrees(-45)).toBe(315);
    expect(normalizeWorkflowDegrees(765)).toBe(45);
  });
});
