import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/store/next/history";
import { LucideLoaderCircle, PlusIcon, RedoIcon, UndoIcon } from "lucide-react";
import { MenuOption } from "./menu-option";
import { useEntitiesStore } from "@/store/next/entities";
import { useEffectsStore } from "@/store/next/effects";
import { EventType, PubSub } from "@/lib/events";

export const HistoryActions = () => {
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);

  const setSelected = useEntitiesStore((state) => state.selectEntity);
  const setSelectedEffect = useEffectsStore((state) => state.setSelected);

  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const stopExporting = () => {
      setExporting(false);
    };

    PubSub.on(EventType.STOP_ASSETS_CREATION, stopExporting);
    return () => {
      PubSub.off(EventType.STOP_ASSETS_CREATION, stopExporting);
    };
  }, []);

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

  const onAddSequence = () => {
    setExporting(true);
    PubSub.emit(EventType.START_ASSETS_CREATION);
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

      <Button
        variant="ghost"
        disabled={exporting}
        className="rounded-xs ml-5 w-32 hover:animate-pulse hover:transition-opacity"
        onClick={onAddSequence}
      >
        {exporting ? (
          <LucideLoaderCircle className="animate-spin" />
        ) : (
          <div className="flex items-center gap-2 flex-row">
            <PlusIcon className="size-4" />
            <span>Add sequence</span>
          </div>
        )}
      </Button>
    </div>
  );
};
