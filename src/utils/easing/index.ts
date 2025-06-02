import type { Keyframe } from "@/components/timeline/types";
import functions from "./functions";

export function interpolateKeyframes(keyframes: Keyframe[], time: number) {
  for (const kf of keyframes) {
    if (time >= kf.start && time <= kf.end) {
      const progress = (time - kf.start) / (kf.end - kf.start);
      const eased = applyEasing(progress, kf.easing);
      return kf.fromValue + (kf.toValue - kf.fromValue) * eased;
    }
  }

  // Fallback: before or after all keyframes
  if (time < keyframes[0]?.start) return keyframes[0]?.fromValue;
  if (time > keyframes[keyframes.length - 1]?.end)
    return keyframes[keyframes.length - 1]?.toValue;

  return 0;
}

function applyEasing(t: number, easing: string) {
  const easingFunction = functions[easing];

  if (!easingFunction) {
    return t;
  }

  return easingFunction(t);
}
