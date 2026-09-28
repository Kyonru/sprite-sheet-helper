import { describe, it, expect } from "vitest";
import * as THREE from "three";

import { PoseSmoother, JointSmoother } from "@/utils/animation-smoothing";

/**
 * A recorded pose has roughly 37 tracks. Every one of them must be filtered
 * against the SAME timestep, and that timestep must come from the frame rather
 * than from how long the machine took to run the loop.
 *
 * The original implementation recomputed dt inside each smoothVec/smoothQuat
 * call from a wall clock and advanced shared state each time, so exactly one
 * track per frame saw a real interval and the rest saw ~1e-7 s. A One Euro
 * alpha is 1/(1 + tau/dt), so those tracks stopped tracking their input.
 */
describe("PoseSmoother timestep", () => {
  it("uses one timestep for every track in a frame", () => {
    const smoother = new PoseSmoother(0.4);
    smoother.beginFrame(0);
    const first = smoother.dt;
    // Many tracks, as buildSmoothedFrame does.
    for (let i = 0; i < 40; i += 1) {
      smoother.smoothVec(`bone${i}.pos`, new THREE.Vector3(1, 0, 0));
      smoother.smoothQuat(`bone${i}.quat`, new THREE.Quaternion());
    }
    expect(smoother.dt).toBe(first);
  });

  it("derives the timestep from frame timestamps, not the wall clock", () => {
    const smoother = new PoseSmoother(0.4);
    smoother.beginFrame(0);
    smoother.beginFrame(1 / 24);
    expect(smoother.dt).toBeCloseTo(1 / 24, 6);
    smoother.beginFrame(2 / 24);
    expect(smoother.dt).toBeCloseTo(1 / 24, 6);
  });

  it("tracks a moving target instead of stalling behind it", () => {
    // The bug's signature: later tracks lag far behind because their dt is
    // effectively zero. With a correct timestep every track converges.
    const smoother = new PoseSmoother(0.4);
    const fps = 30;
    let lastFirst = 0;
    let lastLate = 0;
    let target = 0;

    for (let frame = 0; frame < 90; frame += 1) {
      target = frame / fps; // 1 unit per second
      smoother.beginFrame(frame / fps);
      const v = new THREE.Vector3(target, 0, 0);
      lastFirst = smoother.smoothVec("first.pos", v).x;
      for (let bone = 0; bone < 18; bone += 1) {
        const out = smoother.smoothVec(`bone${bone}.pos`, v).x;
        if (bone === 17) lastLate = out;
      }
    }

    // Every track must behave identically - none is special.
    expect(lastLate).toBeCloseTo(lastFirst, 9);
    // And must be genuinely following the ramp, not stalled near its start.
    expect(lastLate).toBeGreaterThan(target * 0.75);
  });

  it("survives non-monotonic and absurd timestamps", () => {
    const smoother = new PoseSmoother(0.4);
    smoother.beginFrame(10);
    smoother.beginFrame(2); // a seek backwards
    expect(smoother.dt).toBeGreaterThan(0);
    expect(Number.isFinite(smoother.dt)).toBe(true);
    smoother.beginFrame(Number.NaN);
    expect(Number.isFinite(smoother.dt)).toBe(true);
    smoother.beginFrame(1e9); // an absurd jump is clamped, not propagated
    expect(smoother.dt).toBeLessThanOrEqual(0.1);
  });

  it("resets cleanly", () => {
    const smoother = new PoseSmoother(0.4);
    smoother.beginFrame(0);
    smoother.beginFrame(5);
    smoother.reset();
    smoother.beginFrame(100);
    // After a reset the first frame has no predecessor, so it must fall back
    // to the default rather than reporting a 100 second step.
    expect(smoother.dt).toBeCloseTo(1 / 60, 6);
  });

  it("defaults to a sane timestep when beginFrame is never called", () => {
    const smoother = new PoseSmoother(0.4);
    expect(smoother.dt).toBeCloseTo(1 / 60, 6);
    expect(() => smoother.smoothVec("a", new THREE.Vector3())).not.toThrow();
  });
});

describe("JointSmoother", () => {
  it("applies the caller's timestep to every key", () => {
    // JointSmoother already took an explicit dt; this guards that property.
    const smoother = new JointSmoother(1.0, 0.5);
    const dt = 1 / 24;
    const target = new THREE.Vector3(1, 2, 3);
    let a = new THREE.Vector3();
    let b = new THREE.Vector3();
    for (let i = 0; i < 50; i += 1) {
      a = smoother.smooth("a", target, dt);
      b = smoother.smooth("b", target, dt);
    }
    expect(a.distanceTo(b)).toBeLessThan(1e-9);
    expect(a.distanceTo(target)).toBeLessThan(1e-3);
  });

  it("reset clears filter state", () => {
    const smoother = new JointSmoother(1.0, 0.5);
    for (let i = 0; i < 20; i += 1) {
      smoother.smooth("a", new THREE.Vector3(5, 0, 0), 1 / 30);
    }
    smoother.reset();
    // After a reset the next value passes through untouched.
    const out = smoother.smooth("a", new THREE.Vector3(0, 0, 0), 1 / 30);
    expect(out.x).toBeCloseTo(0, 9);
  });
});
