import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import {
  detectContacts,
  solveRootFromContacts,
  solveGroundOffset,
  solveRootFromRigFeet,
  type ContactResult,
} from "@/utils/pose-contacts";

const LM = {
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
} as const;

const FPS = 30;

function blank(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }) as NormalizedLandmark);
}

/**
 * A walk where the feet alternate: one down (MediaPipe y large, since y is
 * DOWN) while the other lifts. `period` frames per full stride.
 */
function walk(frames: number, period: number, speed = 1): NormalizedLandmark[][] {
  return Array.from({ length: frames }, (_, i) => {
    const lm = blank();
    lm[LM.LEFT_HIP] = { x: 0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
    lm[LM.RIGHT_HIP] = { x: -0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
    const phase = (i / period) * Math.PI * 2;
    // Left down for the first half of each stride, right down for the second.
    const leftDown = Math.sin(phase) > 0;
    const setFoot = (heel: number, toe: number, down: boolean, x: number) => {
      const y = down ? 0.85 : 0.6; // larger y = lower in MediaPipe space
      lm[heel] = { x, y, z: 0, visibility: 1 } as NormalizedLandmark;
      lm[toe] = { x: x + 0.05, y, z: 0, visibility: 1 } as NormalizedLandmark;
    };
    // The planted foot slides backwards relative to the hips at the body speed.
    const slide = (speed * i) / FPS;
    setFoot(LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX, leftDown, 0.1 + (leftDown ? slide : -slide));
    setFoot(LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX, !leftDown, -0.1 + (!leftDown ? slide : -slide));
    return lm;
  });
}

describe("detectContacts", () => {
  it("finds alternating contacts in a walk", () => {
    const result = detectContacts(walk(60, 20));
    expect(result.intervals.length).toBeGreaterThanOrEqual(4);
    // Walking has at least one foot down at essentially all times.
    expect(result.groundedRatio).toBeGreaterThan(0.9);
    // Both feet must take turns.
    expect(result.intervals.some((i) => i.side === "left")).toBe(true);
    expect(result.intervals.some((i) => i.side === "right")).toBe(true);
  });

  it("never reports both feet down for the whole clip", () => {
    const result = detectContacts(walk(60, 20));
    const bothDown = result.left.filter((f, i) => f.down && result.right[i].down).length;
    expect(bothDown).toBeLessThan(result.left.length);
  });

  it("derives thresholds from the clip, so scale does not need retuning", () => {
    // The same motion at half the apparent size must give the same contacts.
    const small = walk(60, 20).map((frame) =>
      frame.map((p) => ({ ...p, x: p.x * 0.5, y: p.y * 0.5 }) as NormalizedLandmark),
    );
    const a = detectContacts(walk(60, 20));
    const b = detectContacts(small);
    expect(b.intervals.length).toBe(a.intervals.length);
  });

  it("uses hysteresis to avoid chattering at the threshold", () => {
    // A foot hovering exactly at the boundary must not produce dozens of
    // one-frame contacts.
    const frames = Array.from({ length: 40 }, (_, i) => {
      const lm = blank();
      lm[LM.LEFT_HIP] = { x: 0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      lm[LM.RIGHT_HIP] = { x: -0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      const jitter = i % 2 === 0 ? 0.001 : -0.001;
      for (const [h, t] of [[LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX], [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX]] as const) {
        lm[h] = { x: 0, y: 0.8 + jitter, z: 0, visibility: 1 } as NormalizedLandmark;
        lm[t] = { x: 0, y: 0.8 + jitter, z: 0, visibility: 1 } as NormalizedLandmark;
      }
      return lm;
    });
    const result = detectContacts(frames);
    expect(result.intervals.length).toBeLessThan(5);
  });

  it("drops contacts too short to be real", () => {
    const result = detectContacts(walk(60, 20), { minFrames: 100 });
    expect(result.intervals).toHaveLength(0);
    expect(result.left.every((f) => !f.down)).toBe(true);
  });

  it("handles missing frames and empty input", () => {
    expect(detectContacts([]).intervals).toHaveLength(0);
    const withGaps: (NormalizedLandmark[] | null)[] = walk(20, 10);
    withGaps[5] = null;
    const result = detectContacts(withGaps);
    expect(result.left).toHaveLength(20);
    expect(result.left[5].down).toBe(false);
  });
});

describe("solveRootFromContacts", () => {
  it("recovers body speed from the contact foot", () => {
    const frames = walk(61, 200, 1.0); // long period: left stays down throughout
    const contacts = detectContacts(frames);
    const { translations } = solveRootFromContacts(frames, contacts, FPS, { smoothWindow: 1 });
    // 1 m/s for 2 seconds, mirrored into the app frame.
    expect(Math.abs(translations[60].x)).toBeGreaterThan(1.5);
    expect(translations[0].length()).toBe(0);
  });

  it("carries the last velocity while airborne rather than freezing", () => {
    const frames = walk(30, 200, 1.0);
    const contacts = detectContacts(frames);
    // Force everything airborne after frame 10.
    for (let i = 11; i < 30; i += 1) {
      contacts.left[i].down = false;
      contacts.right[i].down = false;
    }
    const { translations } = solveRootFromContacts(frames, contacts, FPS, { smoothWindow: 1 });
    const before = translations[10].distanceTo(translations[9]);
    const after = translations[29].distanceTo(translations[28]);
    expect(after).toBeCloseTo(before, 6);
  });
});

describe("solveRootFromRigFeet", () => {
  function contactsFor(frames: number, leftDownUntil: number) {
    return {
      left: Array.from({ length: frames }, (_, i) => ({ height: 0, down: i < leftDownUntil })),
      right: Array.from({ length: frames }, (_, i) => ({ height: 0, down: i >= leftDownUntil })),
      intervals: [],
      groundedRatio: 1,
      heightRange: { min: 0, max: 1 },
    };
  }

  it("cancels the rig's own foot motion exactly", () => {
    // This is the property that makes it better than a landmark-derived root:
    // whatever the rig's proportions, the contact foot's motion is exactly
    // what must be cancelled.
    const n = 30;
    const speed = 2; // rig units/sec, backwards relative to the hips
    const hipsRelative = Array.from({ length: n }, (_, i) => ({
      left: new THREE.Vector3(-speed * (i / FPS), -1, 0),
      right: new THREE.Vector3(speed * (i / FPS), -1, 0),
    }));
    const { translations } = solveRootFromRigFeet(hipsRelative, contactsFor(n, n), FPS);
    // Root must advance at +speed to hold the left foot still.
    expect(translations[n - 1].x).toBeCloseTo((speed * (n - 1)) / FPS, 6);

    // And the foot's WORLD position must then be constant.
    for (let i = 1; i < n; i += 1) {
      const world = hipsRelative[i].left.clone().add(translations[i]);
      const first = hipsRelative[0].left.clone().add(translations[0]);
      expect(world.distanceTo(first)).toBeLessThan(1e-9);
    }
  });

  it("switches cleanly between feet", () => {
    const n = 20;
    const hipsRelative = Array.from({ length: n }, (_, i) => ({
      left: new THREE.Vector3(-0.05 * i, -1, 0),
      right: new THREE.Vector3(-0.05 * i, -1, 0),
    }));
    const { translations, solvedFrames } = solveRootFromRigFeet(
      hipsRelative,
      contactsFor(n, 10),
      FPS,
    );
    expect(solvedFrames).toBeGreaterThan(0);
    // Motion is continuous across the handover at frame 10.
    const before = translations[9].distanceTo(translations[8]);
    const after = translations[11].distanceTo(translations[10]);
    expect(Math.abs(after - before)).toBeLessThan(1e-6);
  });

  it("starts at the origin and stays finite", () => {
    const n = 10;
    const hipsRelative = Array.from({ length: n }, () => ({
      left: new THREE.Vector3(0, -1, 0),
      right: new THREE.Vector3(0, -1, 0),
    }));
    const { translations } = solveRootFromRigFeet(hipsRelative, contactsFor(n, 5), FPS);
    expect(translations[0].length()).toBe(0);
    translations.forEach((t) => expect(Number.isFinite(t.x)).toBe(true));
  });
});

describe("per-foot thresholds", () => {
  /**
   * A profile shot where the far foot is estimated systematically higher, as
   * MediaPipe actually does. With one shared threshold the near foot is
   * detected as down far more often than the far one; normalising each foot
   * against its own range cancels that bias.
   */
  function biasedWalk(frames: number, period: number, farFootBias: number) {
    return Array.from({ length: frames }, (_, i) => {
      const lm = blank();
      lm[LM.LEFT_HIP] = { x: 0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      lm[LM.RIGHT_HIP] = { x: -0.1, y: 0, z: 0, visibility: 1 } as NormalizedLandmark;
      const leftDown = Math.sin((i / period) * Math.PI * 2) > 0;
      const put = (heel: number, toe: number, down: boolean, bias: number) => {
        const y = (down ? 0.85 : 0.6) - bias; // smaller y = higher up
        lm[heel] = { x: 0, y, z: 0, visibility: 1 } as NormalizedLandmark;
        lm[toe] = { x: 0.05, y, z: 0, visibility: 1 } as NormalizedLandmark;
      };
      put(LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX, leftDown, 0);
      put(LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX, !leftDown, farFootBias);
      return lm;
    });
  }

  it("cancels a systematic height bias between the feet", () => {
    // The bias has to be big enough to actually push the far foot's "down"
    // height above the SHARED threshold; a smaller one leaves both schemes
    // classifying identically and tests nothing.
    const frames = biasedWalk(60, 20, 0.15);
    const shared = detectContacts(frames, { perFoot: false });
    const perFoot = detectContacts(frames, { perFoot: true });

    const share = (r: typeof shared) => {
      const l = r.left.filter((f) => f.down).length;
      const rr = r.right.filter((f) => f.down).length;
      return Math.abs(l - rr) / r.left.length;
    };
    // Per-foot must be markedly more balanced between the two feet.
    expect(share(perFoot)).toBeLessThan(share(shared));
  });

  it("defaults to per-foot", () => {
    const frames = biasedWalk(60, 20, 0.15);
    const a = detectContacts(frames);
    const b = detectContacts(frames, { perFoot: true });
    expect(a.left.map((f) => f.down)).toEqual(b.left.map((f) => f.down));
  });
});

describe("contact interval trimming", () => {
  it("shortens intervals from both ends", () => {
    const frames = walk(60, 20);
    const none = detectContacts(frames, { trimFrames: 0 });
    const trimmed = detectContacts(frames, { trimFrames: 2 });
    const span = (r: typeof none) =>
      r.intervals.reduce((sum, i) => sum + (i.end - i.start + 1), 0);
    expect(span(trimmed)).toBeLessThan(span(none));
    expect(span(trimmed)).toBeGreaterThan(0);
  });

  it("drops intervals that trimming makes too short", () => {
    const frames = walk(60, 20);
    const trimmed = detectContacts(frames, { trimFrames: 50 });
    expect(trimmed.intervals).toHaveLength(0);
  });

  it("defaults to no trimming", () => {
    // Trimming the SOLVE was measured and makes foot slide worse (9.9 mm ->
    // 14.6 mm with the measurement window held constant). Its apparent benefit
    // came only from measuring fewer frames, so the default must be 0.
    const frames = walk(60, 20);
    const a = detectContacts(frames);
    const b = detectContacts(frames, { trimFrames: 0 });
    expect(a.intervals).toEqual(b.intervals);
  });
});


describe("solveGroundOffset", () => {
  /** A ContactResult with only the fields the ground solve reads. */
  const contactsFrom = (left: boolean[], right: boolean[]): ContactResult => ({
    left: left.map((down) => ({ down, height: 0 })),
    right: right.map((down) => ({ down, height: 0 })),
    intervals: [],
    groundedRatio: 0,
    heightRange: { min: 0, max: 0 },
  });

  it("lifts a floating character so the planted foot reaches y=0", () => {
    // Every planted foot sits 0.2 above the floor: the clip is floating.
    const footY = Array.from({ length: 10 }, () => ({ left: 0.2, right: 0.5 }));
    const contacts = contactsFrom(Array(10).fill(true), Array(10).fill(false));
    const { offset, sampledFrames } = solveGroundOffset(footY, contacts);
    expect(offset).toBeCloseTo(-0.2, 9);
    expect(sampledFrames).toBe(10);
  });

  it("drops a sunken character by the same rule", () => {
    const footY = Array.from({ length: 6 }, () => ({ left: -0.3, right: 0.4 }));
    const contacts = contactsFrom(Array(6).fill(true), Array(6).fill(false));
    expect(solveGroundOffset(footY, contacts).offset).toBeCloseTo(0.3, 9);
  });

  it("ignores AIRBORNE feet, which are not on the floor", () => {
    // The right foot swings far below the left, but is never down.
    const footY = Array.from({ length: 8 }, () => ({ left: 0.2, right: -1.0 }));
    const contacts = contactsFrom(Array(8).fill(true), Array(8).fill(false));
    expect(solveGroundOffset(footY, contacts).offset).toBeCloseTo(-0.2, 9);
  });

  it("is not dragged by one badly reconstructed frame", () => {
    // Nineteen good planted frames at 0.2 and one at -5. The minimum would bury
    // the character five units under the floor for the whole clip.
    const footY = Array.from({ length: 20 }, (_, i) => ({
      left: i === 7 ? -5 : 0.2,
      right: 1,
    }));
    const contacts = contactsFrom(Array(20).fill(true), Array(20).fill(false));
    const { offset, lowestAfterOffset } = solveGroundOffset(footY, contacts);
    expect(offset).toBeCloseTo(-0.2, 9);
    // The outlier is reported rather than hidden.
    expect(lowestAfterOffset).toBeCloseTo(-5.2, 9);
  });

  it("leaves a clip alone when no foot is ever down", () => {
    // Someone seated, or filmed from the waist up. There is no observed floor,
    // and picking one from airborne feet would place the character by whichever
    // frame happened to reach lowest.
    const footY = Array.from({ length: 5 }, () => ({ left: 0.9, right: 0.9 }));
    const result = solveGroundOffset(footY, contactsFrom(Array(5).fill(false), Array(5).fill(false)));
    expect(result).toEqual({ offset: 0, sampledFrames: 0, lowestAfterOffset: 0 });
  });

  it("takes the percentile over BOTH feet's planted frames", () => {
    const footY = [
      { left: 0.1, right: 0.5 },
      { left: 0.5, right: 0.1 },
    ];
    const contacts = contactsFrom([true, false], [false, true]);
    const { offset, sampledFrames } = solveGroundOffset(footY, contacts);
    expect(sampledFrames).toBe(2);
    expect(offset).toBeCloseTo(-0.1, 9);
  });

  it("cannot change foot slide, which is horizontal by construction", () => {
    // Stated as a test because the plan listed ground alignment as the last
    // untried lever on foot slide. Slide is hypot(dx, dz) between consecutive
    // contact frames, so a uniform Y offset is provably inert - confirmed
    // through the benchmark, where --ground-align leaves the mean at
    // 0.0098761 to the last digit.
    const footY = Array.from({ length: 4 }, () => ({ left: 0.2, right: 0.2 }));
    const contacts = contactsFrom(Array(4).fill(true), Array(4).fill(true));
    const { offset } = solveGroundOffset(footY, contacts);
    const before = [
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0.01, 0.2, 0.02),
    ];
    const after = before.map((p) => p.clone().add(new THREE.Vector3(0, offset, 0)));
    const slide = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
    expect(slide(after[0], after[1])).toBeCloseTo(slide(before[0], before[1]), 12);
  });
});
