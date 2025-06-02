import type {
  AnimationObject,
  Keyframe,
  MotionValues,
  TrackProperty,
} from "@/components/timeline/types";
import { getDuration } from "@/utils/animation";
import type { DragEndEvent } from "@dnd-kit/core";
import type { RefObject } from "react";
import { create } from "zustand";

interface AnimationState {
  timeline: AnimationObject[];
  setTimeline: (timeline: AnimationObject[]) => void;
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
  time: number;
  setTime: (time: number) => void;
  increaseTime: (delta: number) => void;
  playing: boolean;
  setPlaying: (status: boolean) => void;
  motionValuesRef?: RefObject<Record<string, MotionValues>>;
  setMotionValuesRef: (ref: RefObject<Record<string, MotionValues>>) => void;
  unit: number;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  unit: 100,
  motionValuesRef: undefined,
  setMotionValuesRef: (ref: RefObject<Record<string, MotionValues>>) =>
    set(() => ({ motionValuesRef: ref })),
  timeline: [],
  onUpdateZoom: (newZoom: number) =>
    set({
      zoom: newZoom,
    }),
  addObject: (id: string) =>
    set((state) => {
      if (state.timeline.find((obj) => obj.id === id)) return state;

      return {
        ...state,
        timeline: [...state.timeline, { id, name: id.slice(0, 6), tracks: [] }],
      };
    }),
  removeObject: (id: string) =>
    set((state) => {
      return {
        ...state,
        timeline: state.timeline.filter((obj) => obj.id !== id),
      };
    }),
  addProperty: (id: string, property: TrackProperty) =>
    set((state) => {
      const objectIndex = state.timeline.findIndex((obj) => obj.id === id);
      if (objectIndex < 0) return state;
      const obj = state.timeline[objectIndex];

      if (obj.tracks.find((track) => track.property === property)) return state;
      return {
        ...state,
        timeline: [
          ...state.timeline.slice(0, objectIndex),
          {
            ...obj,
            tracks: obj.tracks.concat({
              id: `${id}-${property}`,
              property,
              keyframes: [],
            }),
          },
          ...state.timeline.slice(objectIndex + 1),
        ],
      };
    }),
  removeProperty: (id: string, property: string) =>
    set((state) => {
      const objectIndex = state.timeline.findIndex((obj) => obj.id === id);
      if (objectIndex < 0) return state;
      const obj = state.timeline[objectIndex];
      obj.tracks = obj.tracks.filter((track) => track.property !== property);
      return {
        ...state,
        timeline: [
          ...state.timeline.slice(0, objectIndex),
          {
            ...obj,
            tracks: obj.tracks,
          },
          ...state.timeline.slice(objectIndex + 1),
        ],
      };
    }),
  addKeyframe: (id: string, property: TrackProperty, keyframe: Keyframe) =>
    set((state) => {
      const objectIndex = state.timeline.findIndex((obj) => obj.id === id);
      if (objectIndex < 0) return state;
      const obj = state.timeline[objectIndex];
      obj.tracks.forEach((track) => {
        if (track.property !== property) return;
        track.keyframes.push(keyframe);
      });
      return {
        ...state,
        timeline: [
          ...state.timeline.slice(0, objectIndex),
          {
            ...obj,
            tracks: obj.tracks,
          },
          ...state.timeline.slice(objectIndex + 1),
        ],
      };
    }),
  removeKeyframe: (id: string, property: TrackProperty, index: number) =>
    set((state) => {
      const objectIndex = state.timeline.findIndex((obj) => obj.id === id);
      if (objectIndex < 0) return state;
      const obj = state.timeline[objectIndex];
      obj.tracks.forEach((track) => {
        if (track.property !== property) return;
        track.keyframes.splice(index, 1);
      });
      return {
        ...state,
        timeline: [
          ...state.timeline.slice(0, objectIndex),
          {
            ...obj,
            tracks: obj.tracks,
          },
          ...state.timeline.slice(objectIndex + 1),
        ],
      };
    }),
  updateKeyframe: ({
    objectId,
    trackId,
    keyframeIndex,
    draggableEvent,
  }: {
    objectId: string;
    trackId: string;
    keyframeIndex: number;
    draggableEvent: DragEndEvent;
  }) =>
    set((state) => {
      const objectIndex = state.timeline.findIndex(
        (obj) => obj.id === objectId
      );
      if (objectIndex < 0) return state;
      const duration = getDuration(state.timeline);

      const baseWidth = duration * state.unit;
      const timelineWidth = baseWidth * state.zoom;

      const obj = state.timeline[objectIndex];
      const trackIndex = obj.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex < 0) return state;
      const track = obj.tracks[trackIndex];
      if (keyframeIndex < 0) return state;
      const keyframeCopy = track.keyframes[keyframeIndex];
      const pixelsPerSecond = timelineWidth / duration;
      const deltaTime = draggableEvent.delta.x / pixelsPerSecond;
      const shift = Math.max(
        -keyframeCopy.start,
        Math.min(duration - keyframeCopy.end, deltaTime)
      );
      const newStart = keyframeCopy.start + shift / 2;
      const newEnd = keyframeCopy.end + shift / 2;
      keyframeCopy.start = Math.max(0, newStart);
      keyframeCopy.end = Math.min(duration, newEnd);
      track.keyframes[keyframeIndex] = keyframeCopy!;
      return {
        ...state,
        timeline: [
          ...state.timeline.slice(0, objectIndex),
          {
            ...obj,
            tracks: [
              ...obj.tracks.slice(0, trackIndex),
              { ...track, keyframes: track.keyframes },
              ...obj.tracks.slice(trackIndex + 1),
            ],
          },
          ...state.timeline.slice(objectIndex + 1),
        ],
      };
    }),
  zoom: 1,
  setZoom: (zoom: number) =>
    set((state) => {
      return {
        ...state,
        zoom: zoom,
      };
    }),
  time: 0,
  setTime: (time: number) =>
    set((state) => {
      return {
        ...state,
        time: time,
      };
    }),
  increaseTime: (delta: number) =>
    set((state) => {
      if (!state.playing) {
        return state;
      }

      const newTime: number = state.time + delta;
      const duration = getDuration(state.timeline);

      const isOver = newTime >= duration;

      return {
        ...state,
        playing: !isOver,
        time: isOver ? duration : state.time + delta,
      };
    }),
  playing: false,
  setPlaying: (status: boolean) =>
    set((state) => {
      return {
        ...state,
        playing: status,
      };
    }),
  setTimeline(timeline: AnimationObject[]) {
    set({
      timeline: timeline,
    });
  },
}));
