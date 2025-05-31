import type { DragEndEvent } from "@dnd-kit/core";
import { createContext } from "react";
import type { AnimationObject } from "../types";

export const TimelineContext = createContext<{
  objects: AnimationObject[];
  updateKeyframe: (options: {
    objectId: string;
    trackId: string;
    keyframeIndex: number;
    draggableEvent: DragEndEvent;
  }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  duration: number;
  timelineWidth: number;
  baseWidth: number;
  time: number;
  setTime: (time: number) => void;
  playing: boolean;
  setPlaying: (status: boolean) => void;
  unit: number;
}>({
  objects: [],
  updateKeyframe: () => {},
  zoom: 1,
  setZoom: () => {},
  duration: 0,
  timelineWidth: 0,
  baseWidth: 0,
  time: 0,
  setTime: () => {},
  playing: false,
  setPlaying: () => {},
  unit: 100,
});
