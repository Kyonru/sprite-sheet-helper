import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  getCaptureCycleSeconds,
  wrapCaptureTime,
} from "@/utils/capture-timing";

/*
  Capture drives the mixer itself: it freezes playback and seeks to
  `frame × interval`, wrapped into one cycle of the clip. These tests pin the
  two properties that follow from that, because both are load-bearing and
  neither is obvious from reading the capture loop.
*/

/** A one-second clip moving an object from x=0 to x=2 and back. */
function makeAnimated() {
  const object = new THREE.Object3D();
  object.name = "target";

  const clip = new THREE.AnimationClip("walk", 1, [
    new THREE.VectorKeyframeTrack(
      ".position",
      [0, 0.5, 1],
      [0, 0, 0, 2, 0, 0, 0, 0, 0],
    ),
  ]);

  return { object, clip };
}

function sampleAt(
  loop: THREE.AnimationActionLoopStyles,
  times: number[],
  { speed = 1 }: { speed?: number } = {},
): number[] {
  const { object, clip } = makeAnimated();
  const mixer = new THREE.AnimationMixer(object);
  const action = mixer.clipAction(clip);

  // Exactly what the model component sets up before a capture runs.
  action.setDuration((1 / speed) * clip.duration);
  action.reset();
  action.setLoop(loop, Infinity);
  action.play();

  const cycle = getCaptureCycleSeconds({ duration: clip.duration, speed });

  return times.map((time) => {
    mixer.setTime(wrapCaptureTime(time, cycle));
    return Number(object.position.x.toFixed(6));
  });
}

describe("what a capture samples", () => {
  const times = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];

  /*
    The capture loop wraps time into the clip rather than running off the end,
    so the action never reaches its finish and its loop mode never comes into
    play. This is why no `--loop` flag was added, and why the panel's Looping
    control is described as affecting playback rather than capture — if this
    test ever fails, that description is wrong.
  */
  it("does not depend on the clip's loop mode", () => {
    const once = sampleAt(THREE.LoopOnce, times);
    const repeat = sampleAt(THREE.LoopRepeat, times);
    const pingPong = sampleAt(THREE.LoopPingPong, times);

    expect(repeat).toEqual(once);
    expect(pingPong).toEqual(once);
    // The clip really does move, so equality above is not equality of nothing.
    expect(new Set(once).size).toBeGreaterThan(1);
  });

  it("keeps sampling the motion past the end of the clip", () => {
    const firstCycle = sampleAt(THREE.LoopOnce, [0, 0.25, 0.5, 0.75]);
    const secondCycle = sampleAt(THREE.LoopOnce, [1, 1.25, 1.5, 1.75]);

    // Before wrapping, a LoopOnce action stopped evaluating here and every
    // remaining frame held one pose.
    expect(secondCycle).toEqual(firstCycle);
  });

  it("follows playback speed, so a 2x clip is captured in half the time", () => {
    const normal = sampleAt(THREE.LoopOnce, [0, 0.25, 0.5], { speed: 1 });
    const double = sampleAt(THREE.LoopOnce, [0, 0.125, 0.25], { speed: 2 });

    expect(double).toEqual(normal);
  });

  it("gives the same pose for the same frame index every time", () => {
    const first = sampleAt(THREE.LoopOnce, times);
    const second = sampleAt(THREE.LoopOnce, times);

    expect(second).toEqual(first);
  });
});
