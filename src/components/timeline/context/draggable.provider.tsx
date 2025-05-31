import { DndContext } from "@dnd-kit/core";
import { useTimelineContext } from "../hooks/useTimeline";
import { BaseTimelineEditor } from "../base-timeline";

export function DraggableTimelineEditor() {
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
