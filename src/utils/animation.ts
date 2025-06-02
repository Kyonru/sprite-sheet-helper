import { type RefObject } from "react";
import { motionValue, MotionValue } from "framer-motion";
import type { AnimationObject } from "@/components/timeline/types";

export function ensureMotionValue(
  motionValues:
    | RefObject<Record<string, Record<string, MotionValue>>>
    | undefined,
  objectId: string | undefined,
  prop: string,
  initial: number
) {
  if (!motionValues || !objectId) return new MotionValue(0);

  if (!motionValues.current[objectId]) {
    motionValues.current[objectId] = {};
  }

  if (!motionValues.current[objectId][prop]) {
    motionValues.current[objectId][prop] = motionValue(initial);
  }

  return motionValues.current[objectId][prop];
}

export const getDuration = (
  objects: AnimationObject[],
  padding: number = 2
) => {
  const minDuration =
    objects.reduce((acc, obj) => {
      return Math.max(
        acc,
        obj.tracks.reduce((acc, track) => {
          return Math.max(
            acc,
            track.keyframes.reduce((acc, kf) => {
              return Math.max(acc, kf.end);
            }, 0)
          );
        }, 0)
      );
    }, 0) + padding;

  return Math.max(minDuration, 20);
};
