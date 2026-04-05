import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "./ui/dialog";
import DraggableList, { type DraggableItem } from "./draggable-list";

type ReorderState<T extends DraggableItem> = {
  items: T[];
  open: boolean;
  onRenderItem: (item: T) => React.ReactNode;
  onChange: (items: T[]) => void;
  orientation?: "vertical" | "horizontal";
  header?: React.ReactNode;
};

type Listener = <T>(state: ReorderState<T & DraggableItem>) => void;
let _listener: Listener | null = null;

function dispatch<T>(state: ReorderState<T & DraggableItem>) {
  _listener?.(state);
}

export function reorderItems<T extends DraggableItem>(
  options: Omit<ReorderState<T>, "open">,
) {
  const { items, onChange, onRenderItem, orientation, header } = options;
  dispatch({
    onRenderItem,
    onChange,
    open: true,
    items,
    orientation,
    header,
  });
}

export function ReorderModalProvider() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<ReorderState<any>>({
    items: [],
    open: false,
    onChange: () => {},
    onRenderItem: () => {},
    orientation: "vertical",
  });

  useEffect(() => {
    _listener = (next) => {
      setState(next);
    };
    return () => {
      _listener = null;
    };
  }, []);

  const onClose = () => {
    setState((s) => ({ ...s, open: false }));
  };

  const onChangeItems = (items: DraggableItem[]) => {
    setState((s) => ({ ...s, items }));
    state.onChange(items);
  };

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs overflow-scroll">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="z-999 h-[90vh]">
          {state.header && (
            <div className="mb-4 text-lg font-bold">{state.header}</div>
          )}
          <DraggableList
            orientation={state.orientation}
            items={state.items}
            onChange={onChangeItems}
            onRenderItem={state.onRenderItem}
          />
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}
