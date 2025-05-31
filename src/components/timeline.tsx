import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  createContext,
  useContext,
  useMemo,
} from "react";
import { motion, MotionValue } from "motion/react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import Ruler from "@scena/react-ruler";
import { LucideTriangle } from "lucide-react";

interface Keyframe {
  fromValue: number;
  toValue: number;
  start: number;
  end: number;
  easing: "linear" | "easeInOut" | "easeOut";
}

interface Track {
  id: string;
  property: "x" | "opacity";
  keyframes: Keyframe[];
}

interface AnimationObject {
  id: string;
  name: string;
  tracks: Track[];
}

interface MotionValues {
  [property: string]: MotionValue<number>;
}

const initialObjects: AnimationObject[] = [
  {
    id: "object-1",
    name: "Box A",
    tracks: [
      {
        id: "track-1",
        property: "x",
        keyframes: [
          { fromValue: 0, toValue: 300, start: 0, end: 2, easing: "easeInOut" },
          {
            fromValue: 300,
            toValue: 0,
            start: 2.5,
            end: 10,
            easing: "linear",
          },
        ],
      },
      {
        id: "track-2",
        property: "opacity",
        keyframes: [
          {
            fromValue: 1,
            toValue: 0,
            start: 2.5,
            end: 10,
            easing: "easeInOut",
          },
        ],
      },
    ],
  },
  {
    id: "object-2",
    name: "Box B",
    tracks: [
      {
        id: "track-3",
        property: "x",
        keyframes: [
          { fromValue: 300, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "object-3",
    name: "Box C",
    tracks: [
      {
        id: "track-4",
        property: "x",
        keyframes: [
          { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "object-4",
    name: "Box D",
    tracks: [
      {
        id: "track-5",
        property: "x",
        keyframes: [
          { fromValue: 0, toValue: 400, start: 0, end: 2, easing: "easeInOut" },
          {
            fromValue: 400,
            toValue: 300,
            start: 2.5,
            end: 3,
            easing: "easeInOut",
          },
        ],
      },
      {
        id: "track-6",
        property: "opacity",
        keyframes: [
          { fromValue: 1, toValue: 0.2, start: 1, end: 3, easing: "easeOut" },
          {
            fromValue: 0.2,
            toValue: 1,
            start: 3.5,
            end: 4,
            easing: "easeInOut",
          },
        ],
      },
    ],
  },
  {
    id: "object-5",
    name: "Box E",
    tracks: [
      {
        id: "track-7",
        property: "x",
        keyframes: [
          { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
        ],
      },
    ],
  },
  {
    id: "object-6",
    name: "Box F",
    tracks: [
      {
        id: "track-8",
        property: "x",
        keyframes: [
          { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
        ],
      },
    ],
  },
];

const TimeIndicator = () => {
  const { duration, timelineWidth, time } = useTimelineContext();
  return (
    <div
      className="absolute h-full -mt-8 w-1 z-50 bg-[#cb2c36]"
      style={{ left: `${(time / duration) * timelineWidth}px` }}
    >
      <div className="h-full w-full z-50 bg-[#cb2c36]" />
      <div className="relative">
        <LucideTriangle
          fill="#cb2c36"
          stroke="#cb2c36"
          className="absolute -top-[34px] -left-[6px] z-100 rotate-180 size-4"
          style={{
            borderColor: "red",
          }}
        />
      </div>
    </div>
  );
};

const TimelineContext = createContext<{
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
});

function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error(
      "useTimelineContext must be used within a TimelineProvider."
    );
  }

  return context;
}

// const duration = 2;
// const baseWidth = duration * 100;

function easeValue(t: number, kf: Keyframe): number {
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

function interpolate(t: number, keyframes: Keyframe[]): number {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return 0;
  const kf = keyframes.find((k) => t >= k.start && t <= k.end);
  if (!kf)
    return (
      keyframes.find((k) => t < k.start)?.fromValue ??
      keyframes[keyframes.length - 1].toValue
    );
  return easeValue(t, kf);
}

const DroppableTrack = ({
  children,
  id,
}: {
  id: string;
  children: React.ReactNode;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });
  const style = {
    color: isOver ? "green" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex relative flex-1 flex-row"
    >
      {children}
    </div>
  );
};

const DroppableKeyframe = ({
  id,
  title,
  row,
  left,
  width,
  duration,
  objectId,
  trackId,
  keyframeIndex,
}: {
  id: string;
  title: string;
  row: number;
  left: number;
  width: number;
  duration: number;
  objectId: string;
  trackId: string;
  keyframeIndex: number;
}) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id,
      data: {
        objectId: objectId,
        trackId: trackId,
        keyframeIndex: keyframeIndex,
      },
    });

  const style = transform
    ? {
        // transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transform: `translate3d(${transform.x}px, 0px, 0)`,
        backgroundColor: isDragging ? "var(--color-gray-500)" : undefined,
      }
    : {};

  return (
    <div
      ref={setNodeRef}
      title={title}
      className="absolute h-6 py-1"
      style={{
        left,
        width,
        top: row * 24 + 32,
        ...style,
      }}
      {...listeners}
      {...attributes}
    >
      <div className="w-full h-full bg-chart-3/70">
        <p className="text-xs text-center text-white">
          {Math.round(duration).toFixed(2)}s
        </p>
      </div>
    </div>
  );
};

const unit = 100;

export function BaseTimelineEditor() {
  const {
    objects,
    zoom,
    setZoom,
    duration,
    timelineWidth,
    playing,
    setPlaying,
    time,
    setTime,
  } = useTimelineContext();
  const motionValues = useRef<Record<string, MotionValues>>({});
  objects.forEach((obj) => {
    if (!motionValues.current[obj.id]) {
      motionValues.current[obj.id] = {
        x: new MotionValue(0),
        opacity: new MotionValue(1),
      };
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (!playing) return;
      setTime((t: number) => {
        const newTime: number = t + 0.016;
        if (newTime >= duration) {
          setPlaying(false);
          return duration;
        }
        return newTime;
      });
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, playing]);

  useEffect(() => {
    for (const obj of objects) {
      for (const track of obj.tracks) {
        if (!Array.isArray(track.keyframes) || track.keyframes.length === 0)
          continue;
        const value = interpolate(time, track.keyframes);
        if (motionValues.current[obj.id][track.property]) {
          motionValues.current[obj.id][track.property].set(value);
        }
      }
    }
  }, [time, objects]);

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setTime(newTime);
    setPlaying(false);
  };

  return (
    <>
      {/* Preview items */}
      <div className="h-32 flex items-center gap-4">
        {objects.map((obj) => (
          <motion.div
            key={obj.id}
            className="w-12 h-12 bg-chart-3 rounded"
            style={{
              x: motionValues.current[obj.id].x,
              opacity: motionValues.current[obj.id].opacity,
            }}
          />
        ))}
      </div>
      <div className="p-4 bg-primary-foreground font-sans space-y-4 no-scrollbar">
        <div className="flex items-center gap-2">
          <button
            className="bg-blue-500 text-white w-32 px-3 py-1 rounded"
            onClick={() => {
              setPlaying(!playing);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <p className="text-sm w-32">Time: {time.toFixed(2)}s</p>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.01"
            value={time}
            onChange={handleTimeChange}
            className="w-48"
          />
          <label className="ml-4 text-sm">Zoom</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </div>
        <div
          className="flex flex-col w-full"
          onScroll={(e) => {
            console.log(e);
          }}
        >
          {/* Shared horizontal scroll container */}
          <div className="w-full overflow-x-auto no-scrollbar max-h-52 overflow-y-auto">
            <div
              style={{ width: timelineWidth }}
              className="flex flex-col min-w-max"
            >
              {/* Top timeline header */}
              <div className="flex sticky z-200 top-0">
                <div className="w-[150px] sticky z-100 top-0 left-0 border-b border-r h-[32px] bg-muted" />
                <div
                  className="relative h-8"
                  onClick={(e) => {
                    console.log(e);
                    // const width = e.nativeEvent.target.clientWidth /c
                    const newTime =
                      (e.nativeEvent.offsetX / timelineWidth) * duration;
                    console.log(timelineWidth, e.nativeEvent.offsetX, newTime);
                    setTime(newTime);
                  }}
                >
                  <Ruler
                    type="horizontal"
                    width={timelineWidth}
                    unit={unit}
                    zoom={zoom}
                    textFormat={(scale) => {
                      return `${Math.round(scale / unit)}s`;
                    }}
                  />
                  <TimeIndicator />
                </div>
              </div>
              {/* Tracks content */}
              {objects.map((obj) => (
                <div key={obj.id} className="flex flex-row">
                  <div className="w-[150px] sticky left-0 z-100 bg-muted border-b border-r">
                    <div className="px-2 py-1 font-medium text-sm bg-popover text-popover-foreground border-b h-[32px]">
                      {obj.name}
                    </div>
                    {obj.tracks.map((track) => (
                      <div
                        key={track.id}
                        className="px-3 py-1 text-xs border-b text-muted-foreground h-6 flex items-center"
                      >
                        {track.property}
                      </div>
                    ))}
                  </div>
                  <DroppableTrack id={obj.id}>
                    {obj.tracks.map((track, j) =>
                      track.keyframes.map((kf, i) => {
                        const left = (kf.start / duration) * timelineWidth;
                        const width =
                          ((kf.end - kf.start) / duration) * timelineWidth;
                        const keyDuration = kf.end - kf.start;
                        return (
                          <DroppableKeyframe
                            id={`${track.id}-${i}`}
                            key={i}
                            title={`${track.property}: ${kf.fromValue} → ${kf.toValue}`}
                            row={j}
                            left={left}
                            width={width}
                            duration={keyDuration}
                            objectId={obj.id}
                            trackId={track.id}
                            keyframeIndex={i}
                          />
                        );
                      })
                    )}
                    <div
                      className="absolute w-1 z-50 h-full bg-[#cb2c36] "
                      style={{
                        left: `${(time / duration) * timelineWidth}px`,
                      }}
                    />
                  </DroppableTrack>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DraggableTimelineEditor() {
  const { updateKeyframe } = useTimelineContext();

  return (
    <DndContext
      onDragEnd={(a) => {
        updateKeyframe({
          objectId: a.active.data.current?.objectId,
          trackId: a.active.data.current?.trackId,
          keyframeIndex: a.active.data.current?.keyframeIndex,
          draggableEvent: a,
        });
      }}
    >
      <BaseTimelineEditor />
    </DndContext>
  );
}

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
    console.log({
      objectId,
      trackId,
      keyframeIndex,
      draggableEvent,
    });

    setObjects((objects) => {
      const objectIndex = objects.findIndex((obj) => obj.id === objectId);
      if (objectIndex < 0) return objects;

      const obj = objects[objectIndex];

      const trackIndex = obj.tracks.findIndex((t) => t.id === trackId);
      if (trackIndex < 0) return objects;

      const track = obj.tracks[trackIndex];

      if (keyframeIndex < 0) return objects;

      const keyframeCopy = track.keyframes[keyframeIndex];

      // keyframeCopy.fromValue = draggableEvent.current.x;
      // keyframeCopy.toValue = draggableEvent.current.x;
      // keyframeCopy.start = draggableEvent.current.x;
      // keyframeCopy.end = draggableEvent.current.x;

      // delta x to time value

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
      }}
    >
      <DraggableTimelineEditor />
    </TimelineContext.Provider>
  );
}
