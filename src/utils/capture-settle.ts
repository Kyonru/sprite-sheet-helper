/**
 * Waiting for the view to stop moving before a frame is recorded.
 *
 * A workflow step sets its camera through the store and an event, and the
 * controls apply it on one of the following frames. Capture seeks animation
 * time, so its first frame arrives one animation frame after the step starts —
 * early enough, under load, to record the previous step's angle. Counting
 * frames and hoping is what produced a flaky reproducibility run; waiting for
 * the transform to repeat itself is a fact about the scene rather than a guess
 * about the machine.
 */

export type WaitForStableInput<T> = {
  /** Reads the value being watched, once per frame. */
  sample: () => T;
  equals: (a: T, b: T) => boolean;
  /** Yields until the next rendered frame. */
  waitFrame: () => Promise<void>;
  /** Consecutive unchanged samples that count as settled. */
  stableFrames?: number;
  /** Give up after this many frames and let the caller proceed anyway. */
  maxFrames?: number;
};

/**
 * Poll until a value stops changing.
 *
 * Returns whether it settled: a caller that times out is recording a view that
 * is still moving, which is worth knowing even though carrying on is better
 * than stalling a run.
 */
export async function waitForStable<T>({
  sample,
  equals,
  waitFrame,
  stableFrames = 2,
  maxFrames = 20,
}: WaitForStableInput<T>): Promise<boolean> {
  let previous = sample();
  let stable = 0;

  for (let frame = 0; frame < maxFrames; frame += 1) {
    await waitFrame();
    const current = sample();

    if (equals(current, previous)) {
      stable += 1;
      if (stable >= stableFrames) return true;
      continue;
    }

    stable = 0;
    previous = current;
  }

  return false;
}
