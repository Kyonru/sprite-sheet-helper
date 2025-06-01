import type { DragEndEvent } from "@dnd-kit/core";
import { createContext } from "react";
import type { AnimationObject, Keyframe, TrackProperty } from "../types";
import type { StoreType } from "leva/dist/declarations/src/types";

export const TimelineContext = createContext<{
  objects: AnimationObject[];
  addObject: (id: string) => void;
  removeObject: (id: string) => void;
  addProperty: (id: string, property: TrackProperty) => void;
  removeProperty: (id: string, property: TrackProperty) => void;
  updateKeyframe: (options: {
    objectId: string;
    trackId: string;
    keyframeIndex: number;
    draggableEvent: DragEndEvent;
  }) => void;
  addKeyframe: (
    id: string,
    property: TrackProperty,
    keyframe: Keyframe
  ) => void;
  removeKeyframe: (id: string, property: TrackProperty, index: number) => void;
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
  uiStore?: StoreType;
  propertyStore?: StoreType;
  keyframeStore?: StoreType;
}>({
  objects: [],
  addObject: () => {},
  removeObject: () => {},
  addProperty: () => {},
  removeProperty: () => {},
  updateKeyframe: () => {},
  addKeyframe: () => {},
  removeKeyframe: () => {},
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
