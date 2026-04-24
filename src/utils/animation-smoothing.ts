import * as THREE from "three";

// Exponential moving average smoother per bone quaternion/position
export class PoseSmoother {
  private quatMap = new Map<string, THREE.Quaternion>();
  private vecMap = new Map<string, THREE.Vector3>();

  constructor(private alpha = 0.4) {}

  smoothQuat(key: string, next: THREE.Quaternion): THREE.Quaternion {
    const prev = this.quatMap.get(key);
    if (!prev) {
      const q = next.clone();
      this.quatMap.set(key, q);
      return q;
    }
    prev.slerp(next, this.alpha);
    return prev.clone();
  }

  smoothVec(key: string, next: THREE.Vector3): THREE.Vector3 {
    const prev = this.vecMap.get(key);
    if (!prev) {
      const v = next.clone();
      this.vecMap.set(key, v);
      return v;
    }
    prev.lerp(next, this.alpha);
    return prev.clone();
  }

  reset() {
    this.quatMap.clear();
    this.vecMap.clear();
  }
}
