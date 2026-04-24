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

export class PoseSmoother {
  private quatFilters = new Map<string, OneEuroQuat>();
  private vecFilters = new Map<string, OneEuroVec3>();
  private lastTime = 0;
  private minCutoff: number;
  private beta: number;

  constructor(minCutoff = 2.0, beta = 0.3) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  smoothQuat(key: string, q: THREE.Quaternion): THREE.Quaternion {
    const dt = this.dt();
    let f = this.quatFilters.get(key);
    if (!f) { f = new OneEuroQuat(this.minCutoff, this.beta); this.quatFilters.set(key, f); }
    return f.filter(q, dt);
  }

  smoothVec(key: string, v: THREE.Vector3): THREE.Vector3 {
    const dt = this.dt();
    let f = this.vecFilters.get(key);
    if (!f) { f = new OneEuroVec3(this.minCutoff, this.beta); this.vecFilters.set(key, f); }
    return f.filter(v, dt);
  }

  reset() {
    this.quatFilters.forEach((f) => f.reset());
    this.vecFilters.forEach((f) => f.reset());
    this.lastTime = 0;
  }

  private dt() {
    const now = performance.now() / 1000;
    const dt = this.lastTime > 0 ? now - this.lastTime : 1 / 60;
    this.lastTime = now;
    return Math.min(dt, 0.1);
  }
}
