import { useState, useMemo } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import type { AnimationObject } from "./types";
import { TimelineContext } from "./context/timeline-context";
import { DraggableTimelineEditor } from "./context/draggable.provider";

const initialObjects: AnimationObject[] = [
  // {
  //   id: "object-1",
  //   name: "Box A",
  //   tracks: [
  //     {
  //       id: "track-1",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 0, toValue: 300, start: 0, end: 2, easing: "easeInOut" },
  //         {
  //           fromValue: 300,
  //           toValue: 0,
  //           start: 2.5,
  //           end: 10,
  //           easing: "linear",
  //         },
  //       ],
  //     },
  //     {
  //       id: "track-2",
  //       property: "opacity",
  //       keyframes: [
  //         {
  //           fromValue: 1,
  //           toValue: 0,
  //           start: 2.5,
  //           end: 10,
  //           easing: "easeInOut",
  //         },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "object-2",
  //   name: "Box B",
  //   tracks: [
  //     {
  //       id: "track-3",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 300, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "object-3",
  //   name: "Box C",
  //   tracks: [
  //     {
  //       id: "track-4",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "object-4",
  //   name: "Box D",
  //   tracks: [
  //     {
  //       id: "track-5",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 0, toValue: 400, start: 0, end: 2, easing: "easeInOut" },
  //         {
  //           fromValue: 400,
  //           toValue: 300,
  //           start: 2.5,
  //           end: 3,
  //           easing: "easeInOut",
  //         },
  //       ],
  //     },
  //     {
  //       id: "track-6",
  //       property: "opacity",
  //       keyframes: [
  //         { fromValue: 1, toValue: 0.2, start: 1, end: 3, easing: "easeOut" },
  //         {
  //           fromValue: 0.2,
  //           toValue: 1,
  //           start: 3.5,
  //           end: 4,
  //           easing: "easeInOut",
  //         },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "object-5",
  //   name: "Box E",
  //   tracks: [
  //     {
  //       id: "track-7",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: "object-6",
  //   name: "Box F",
  //   tracks: [
  //     {
  //       id: "track-8",
  //       property: "x",
  //       keyframes: [
  //         { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
  //       ],
  //     },
  //   ],
  // },
];

const unit = 100;

export default function TimelineEditor() {
  const [objects, setObjects] = useState<AnimationObject[]>(initialObjects);
  const [zoom, setZoom] = useState<number>(1);
  const [time, setTime] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const padding = 2;

  const onUpdateZoom = (newZoom: number) => {
    setZoom(newZoom);
  };

  const updateKeyframe = ({
    objectId,
    trackId,
    keyframeIndex,
    draggableEvent,
  }: {
    objectId: string;
    trackId: string;
    keyframeIndex: number;
    draggableEvent: DragEndEvent;
  }) => {
    setObjects((objects) => {
      const objectIndex = objects.findIndex((obj) => obj.id === objectId);
      if (objectIndex < 0) return objects;

      const obj = objects[objectIndex];

      const trackIndex = obj.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex < 0) return objects;

      const track = obj.tracks[trackIndex];

      if (keyframeIndex < 0) return objects;

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

      return [
        ...objects.slice(0, objectIndex),
        {
          ...obj,
          tracks: [
            ...obj.tracks.slice(0, trackIndex),
            { ...track, keyframes: track.keyframes },
            ...obj.tracks.slice(trackIndex + 1),
          ],
        },
        ...objects.slice(objectIndex + 1),
      ];
    });
  };

  const duration = useMemo(() => {
    if (objects.length === 0) return 20;

    return (
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
      }, 0) + padding
    );
  }, [objects]);

  const baseWidth = duration * unit;
  const timelineWidth = baseWidth * zoom;

  return (
    <TimelineContext.Provider
      value={{
        objects: objects,
        updateKeyframe,
        zoom,
        setZoom: onUpdateZoom,
        duration,
        timelineWidth,
        baseWidth,
        time,
        setTime,
        playing,
        setPlaying,
        unit,
      }}
    >
      <DraggableTimelineEditor />
    </TimelineContext.Provider>
  );
}
