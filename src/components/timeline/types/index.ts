import type { MotionValue } from "motion/react";

export type Easing = "linear" | "easeInOut" | "easeOut";

export interface Keyframe {
  fromValue: number;
  toValue: number;
  start: number;
  end: number;
  easing: Easing;
}
export type TrackProperty = "x" | "y" | "z" | "opacity";

export interface Track {
  id: string;
  property: TrackProperty;
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
