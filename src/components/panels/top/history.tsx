import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/store/next/history";
import { LucideLoaderCircle, PlusIcon, RedoIcon, UndoIcon } from "lucide-react";
import { MenuOption } from "./menu-option";
import { EventType, PubSub, ShortCutEventType } from "@/lib/events";
import { formatCommandByPlatform } from "@/utils/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const HistoryActions = () => {
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const stopExporting = () => {
      setExporting(false);
    };
    const startExporting = () => {
      setExporting(true);
    };

    PubSub.on(EventType.START_ASSETS_CREATION, startExporting);
    PubSub.on(EventType.STOP_ASSETS_CREATION, stopExporting);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, startExporting);
      PubSub.off(EventType.STOP_ASSETS_CREATION, stopExporting);
    };
  }, []);

  const onUndo = () => {
    PubSub.emit(EventType.SHORT_CUT, { type: ShortCutEventType.UNDO });
  };

  const onRedo = () => {
    PubSub.emit(EventType.SHORT_CUT, { type: ShortCutEventType.REDO });
  };

  const onAddSequence = () => {
    PubSub.emit(EventType.START_ASSETS_CREATION);
  };

  return (
    <div className="flex items-center flex-row gap-2 pr-4">
      <MenuOption title={`Undo (${formatCommandByPlatform("⌘Z")})`}>
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

      <MenuOption title={`Redo (${formatCommandByPlatform("⌘⇧Z")})`}>
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

      <Tooltip key="bottom">
        <TooltipTrigger asChild>
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
                <span>Record sequence</span>
              </div>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{formatCommandByPlatform("⌘⏎")}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
