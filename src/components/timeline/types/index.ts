import type { MotionValue } from "motion/react";

export interface Keyframe {
  fromValue: number;
  toValue: number;
  start: number;
  end: number;
  easing: "linear" | "easeInOut" | "easeOut";
}

export interface Track {
  id: string;
  property: "x" | "opacity";
  keyframes: Keyframe[];
}

export interface AnimationObject {
  id: string;
  name: string;
  tracks: Track[];
}

export interface MotionValues {
  [property: string]: MotionValue<number>;
}
