import { useState, useRef, useEffect, useCallback } from "react";
import { GripVertical, GripHorizontal, X } from "lucide-react";

export type DraggableItem = {
  id: string | number;
};

interface DragState {
  dragIndex: number | null;
  overIndex: number | null;
}

const SCROLL_ZONE = 40; // px from edge to trigger scroll
const SCROLL_SPEED = 8; // px per frame

function DraggableList({
  items,
  onChange,
  orientation = "vertical",
  className = "",
  onRenderItem,
}: {
  items: DraggableItem[];
  onChange: (items: DraggableItem[]) => void;
  onRenderItem?: (item: DraggableItem) => React.ReactNode;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const [drag, setDrag] = useState<DragState>({
    dragIndex: null,
    overIndex: null,
  });
  const containerRef = useRef<HTMLUListElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isHorizontal = orientation === "horizontal";

  // Auto-scroll loop
  const startScrollLoop = useCallback(() => {
    const scroll = () => {
      const el = containerRef.current;
      if (!el) return;

      const { x, y } = pointerRef.current;
      const rect = el.getBoundingClientRect();

      if (isHorizontal) {
        const fromLeft = x - rect.left;
        const fromRight = rect.right - x;
        if (fromLeft < SCROLL_ZONE)
          el.scrollLeft -= SCROLL_SPEED * (1 - fromLeft / SCROLL_ZONE);
        else if (fromRight < SCROLL_ZONE)
          el.scrollLeft += SCROLL_SPEED * (1 - fromRight / SCROLL_ZONE);
      } else {
        const fromTop = y - rect.top;
        const fromBottom = rect.bottom - y;
        if (fromTop < SCROLL_ZONE)
          el.scrollTop -= SCROLL_SPEED * (1 - fromTop / SCROLL_ZONE);
        else if (fromBottom < SCROLL_ZONE)
          el.scrollTop += SCROLL_SPEED * (1 - fromBottom / SCROLL_ZONE);
      }

      scrollRafRef.current = requestAnimationFrame(scroll);
    };
    scrollRafRef.current = requestAnimationFrame(scroll);
  }, [isHorizontal]);

  const stopScrollLoop = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  // Track pointer position globally during drag
  useEffect(() => {
    if (drag.dragIndex === null) {
      stopScrollLoop();
      return;
    }

    const onDragOver = (e: DragEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("dragover", onDragOver);
    startScrollLoop();

    return () => {
      window.removeEventListener("dragover", onDragOver);
      stopScrollLoop();
    };
  }, [drag.dragIndex, startScrollLoop, stopScrollLoop]);

  const onDragStart = (e: React.DragEvent, index: number) => {
    setTimeout(() => setDrag((d) => ({ ...d, dragIndex: index })), 0);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnter = (index: number) => {
    if (drag.dragIndex === null || drag.dragIndex === index) return;
    setDrag((d) => ({ ...d, overIndex: index }));
  };

  const onDragEnd = () => {
    const { dragIndex, overIndex } = drag;
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const next = [...items];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      onChange(next);
    }
    setDrag({ dragIndex: null, overIndex: null });
  };

  const onDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <ul
      ref={containerRef}
      className={`
        flex gap-1 overflow-auto
        ${isHorizontal ? "flex-row" : "flex-col"}
        ${className}
      `}
    >
      {items.map((item, index) => {
        const isDragging = drag.dragIndex === index;
        const isOver = drag.overIndex === index;

        return (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={() => onDragEnter(index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md border shrink-0
              bg-background select-none transition-all duration-100
              justify-between
              ${isDragging ? "opacity-40" : "opacity-100"}
              ${
                isOver
                  ? isHorizontal
                    ? "border-primary "
                    : "border-primary "
                  : "border-border"
              }
            `}
          >
            {isHorizontal ? (
              <GripHorizontal className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
            ) : (
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
            )}
            {onRenderItem?.(item) ?? (
              <span className="text-sm whitespace-nowrap">{item.id}</span>
            )}
            <button
              onClick={() => onDelete(index)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default DraggableList;
