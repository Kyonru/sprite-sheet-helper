import { useDraggable, useDroppable } from "@dnd-kit/core";

export const DroppableTrack = ({
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

export const DroppableKeyframe = ({
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
