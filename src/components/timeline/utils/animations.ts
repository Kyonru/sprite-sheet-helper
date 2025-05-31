import type { Keyframe } from "../types";

export function interpolate(t: number, keyframes: Keyframe[]): number {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return 0;
  const kf = keyframes.find((k) => t >= k.start && t <= k.end);
  if (!kf)
    return (
      keyframes.find((k) => t < k.start)?.fromValue ??
      keyframes[keyframes.length - 1].toValue
    );
  return easeValue(t, kf);
}

export function easeValue(t: number, kf: Keyframe): number {
  const progress = (t - kf.start) / (kf.end - kf.start);
  switch (kf.easing) {
    case "easeInOut":
      return (
        kf.fromValue +
        (kf.toValue - kf.fromValue) *
          (-0.5 * (Math.cos(Math.PI * progress) - 1))
      );
    case "easeOut":
      return (
        kf.fromValue +
        (kf.toValue - kf.fromValue) * Math.sin((progress * Math.PI) / 2)
      );
    default:
      return kf.fromValue + (kf.toValue - kf.fromValue) * progress;
  }
}
