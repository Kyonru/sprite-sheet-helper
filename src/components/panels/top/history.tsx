import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/store/next/history";
import { RedoIcon, UndoIcon } from "lucide-react";
import { MenuOption } from "./menu-option";
import { useEntitiesStore } from "@/store/next/entities";
import { useEffectsStore } from "@/store/next/effects";

export const HistoryActions = () => {
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);

  const setSelected = useEntitiesStore((state) => state.selectEntity);
  const setSelectedEffect = useEffectsStore((state) => state.setSelected);

  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);

  const resetSelection = () => {
    setSelected(undefined);
    setSelectedEffect(undefined);
  };

  const onUndo = () => {
    resetSelection();
    undo();
  };

  const onRedo = () => {
    resetSelection();
    redo();
  };

  return (
    <div className="flex items-center flex-row gap-2 pr-4">
      <MenuOption title="Undo">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-xs"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <UndoIcon className="size-4" />
        </Button>
      </MenuOption>

      <MenuOption title="Redo">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 rounded-xs"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <RedoIcon className="size-4" />
        </Button>
      </MenuOption>
    </div>
  );
};
