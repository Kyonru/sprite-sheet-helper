import * as THREE from "three";

// ── One Euro Filter ────────────────────────────────────────────────────────────
// Adapts: heavy smoothing at rest, more responsive during fast motion.
// Reference: Casiez et al. 2012 "1€ Filter"

function computeAlpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

class OneEuroVec3 {
  private prev: THREE.Vector3 | null = null;
  private prevDeriv = new THREE.Vector3();
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(minCutoff = 1.0, beta = 0.5, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(v: THREE.Vector3, dt: number): THREE.Vector3 {
    const safeDt = Math.max(dt, 1e-4);
    if (!this.prev) { this.prev = v.clone(); return v.clone(); }
    const alphaD = computeAlpha(this.dCutoff, safeDt);
    const deriv = v.clone().sub(this.prev).divideScalar(safeDt);
    this.prevDeriv.lerp(deriv, alphaD);
    const cutoff = this.minCutoff + this.beta * this.prevDeriv.length();
    this.prev.lerp(v, computeAlpha(cutoff, safeDt));
    return this.prev.clone();
  }

  reset() { this.prev = null; this.prevDeriv.set(0, 0, 0); }
}

class OneEuroQuat {
  private prev: THREE.Quaternion | null = null;
  private prevDeriv = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(minCutoff = 1.0, beta = 0.5, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(q: THREE.Quaternion, dt: number): THREE.Quaternion {
    const safeDt = Math.max(dt, 1e-4);
    if (!this.prev) { this.prev = q.clone(); return q.clone(); }
    const alphaD = computeAlpha(this.dCutoff, safeDt);
    const dot = Math.min(1, Math.abs(this.prev.dot(q)));
    const angularSpeed = (2 * Math.acos(dot)) / safeDt;
    this.prevDeriv = alphaD * angularSpeed + (1 - alphaD) * this.prevDeriv;
    const cutoff = this.minCutoff + this.beta * this.prevDeriv;
    this.prev.slerp(q, computeAlpha(cutoff, safeDt));
    return this.prev.clone();
  }

  reset() { this.prev = null; this.prevDeriv = 0; }
}

// ── Joint position smoother (used in the live preview) ────────────────────────
// Apply to raw landmark positions before bone direction computation so both
// the preview and the recorded keyframes benefit from the same smoothing.

export class JointSmoother {
  private filters = new Map<string, OneEuroVec3>();
  private minCutoff: number;
  private beta: number;

  constructor(minCutoff = 1.0, beta = 0.5) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  smooth(key: string, v: THREE.Vector3, dt: number): THREE.Vector3 {
    let f = this.filters.get(key);
    if (!f) { f = new OneEuroVec3(this.minCutoff, this.beta); this.filters.set(key, f); }
    return f.filter(v, dt);
  }

  reset() { this.filters.forEach((f) => f.reset()); }
}

// ── Pose smoother (secondary pass at recording time) ──────────────────────────
// Joint positions are already smoothed in the preview; this light pass handles
// frame-rate differences between the R3F loop and the React recording effect.

/** Shortest and longest timestep the filters will act on, in seconds. */
const MIN_DT = 1 / 240;
const MAX_DT = 0.1;
const DEFAULT_DT = 1 / 60;

export class PoseSmoother {
  private quatFilters = new Map<string, OneEuroQuat>();
  private vecFilters = new Map<string, OneEuroVec3>();
  private lastFrameTime: number | null = null;
  private frameDt = DEFAULT_DT;
  private minCutoff: number;
  private beta: number;

  constructor(minCutoff = 2.0, beta = 0.3) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  /**
   * Open a new frame and fix the timestep every filter in it will use.
   *
   * This exists because the timestep used to be recomputed inside every
   * `smoothQuat`/`smoothVec` call, from a wall clock, advancing a shared
   * `lastTime` each time. A pose has roughly 37 tracks, so exactly one filter
   * per frame saw a real inter-frame interval and the other 36 saw the time it
   * took to run a few lines of JavaScript. Measured directly, five consecutive
   * calls within one frame saw:
   *
   *     16.7 ms, 4.6e-7 s, 2.1e-7 s, 8.4e-8 s, 8.3e-8 s
   *
   * A One Euro filter's alpha is `1 / (1 + tau/dt)`, so a dt near zero drives
   * alpha to near zero and the filter stops tracking: the affected bones lag
   * badly (34% behind on a ramp in a synthetic test) rather than being
   * smoothed. Fixing it also removes the wall clock, so results no longer
   * depend on how fast the machine happens to run - the same video now yields
   * the same animation on any host, which is what makes the whole thing
   * measurable.
   *
   * @param time The frame's own timestamp in seconds. Omit only for a live
   *   source with no timestamp, where wall-clock timing is genuinely correct.
   */
  beginFrame(time?: number): void {
    const now = time ?? performance.now() / 1000;
    const raw = this.lastFrameTime === null ? DEFAULT_DT : now - this.lastFrameTime;
    this.lastFrameTime = now;
    // A non-monotonic or absurd timestamp (a seek, a dropped frame) must not
    // poison the filter state.
    this.frameDt = Number.isFinite(raw) && raw > 0 ? Math.min(Math.max(raw, MIN_DT), MAX_DT) : DEFAULT_DT;
  }

  smoothQuat(key: string, q: THREE.Quaternion): THREE.Quaternion {
    let f = this.quatFilters.get(key);
    if (!f) { f = new OneEuroQuat(this.minCutoff, this.beta); this.quatFilters.set(key, f); }
    return f.filter(q, this.frameDt);
  }

  smoothVec(key: string, v: THREE.Vector3): THREE.Vector3 {
    let f = this.vecFilters.get(key);
    if (!f) { f = new OneEuroVec3(this.minCutoff, this.beta); this.vecFilters.set(key, f); }
    return f.filter(v, this.frameDt);
  }

  /** The timestep the current frame's filters are using, in seconds. */
  get dt(): number {
    return this.frameDt;
  }

  reset() {
    this.quatFilters.forEach((f) => f.reset());
    this.vecFilters.forEach((f) => f.reset());
    this.lastFrameTime = null;
    this.frameDt = DEFAULT_DT;
  }
}
