import { useMemo, useRef, useState } from "react";
import {
  CopyIcon,
  GripVertical,
  Layers,
  Sparkles,
  Trash2Icon,
} from "lucide-react";
import { confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  EFFECT_METADATA_BY_TYPE,
  EFFECT_CATEGORY_LABELS,
} from "@/constants/effects";
import { cn } from "@/lib/utils";
import { useEffectsStore } from "@/store/next/effects";
import { getOrderedEffects } from "@/utils/effects";

export const EffectsExplorer = () => {
  const effects = useEffectsStore((state) => state.effects);
  const order = useEffectsStore((state) => state.order);
  const selected = useEffectsStore((state) => state.selected);
  const setEffect = useEffectsStore((state) => state.setEffect);
  const setSelected = useEffectsStore((state) => state.setSelected);
  const removeEffect = useEffectsStore((state) => state.removeEffect);
  const reorderEffects = useEffectsStore((state) => state.reorderEffects);
  const duplicateEffect = useEffectsStore((state) => state.duplicateEffect);
  const clearEffects = useEffectsStore((state) => state.clearEffects);
  const draggingIdRef = useRef<string | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const orderedEffects = useMemo(
    () => getOrderedEffects(effects, order),
    [effects, order],
  );

  const moveDraggingEffect = (targetId: string) => {
    const activeId = draggingIdRef.current ?? draggingId;
    if (!activeId || activeId === targetId) return;
    if (lastDragTargetRef.current === targetId) return;

    const ids = orderedEffects.map((entry) => entry.uuid);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    lastDragTargetRef.current = targetId;
    reorderEffects(next);
  };

  const endDrag = () => {
    draggingIdRef.current = null;
    lastDragTargetRef.current = null;
    setDraggingId(null);
  };

  const onRemove = (uuid: string) => {
    const effect = effects[uuid];
    const title = effect
      ? EFFECT_METADATA_BY_TYPE[effect.type].name
      : "Effect";

    confirm.delete(title, {
      onConfirm: () => removeEffect(uuid),
    });
  };

  const onClear = () => {
    confirm.delete("all effects", {
      onConfirm: clearEffects,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Layers size={14} />
            Effects Stack
          </div>
          <p className="text-xs text-muted-foreground">
            Drag to reorder the post-process chain.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          title="Clear effects"
          onClick={onClear}
          disabled={orderedEffects.length === 0}
        >
          <Trash2Icon size={14} />
        </Button>
      </div>

      {orderedEffects.length === 0 ? (
        <div className="grid flex-1 place-items-center px-4 text-center text-sm text-muted-foreground">
          <div>
            <Sparkles className="mx-auto mb-2 size-5" />
            Add a preset or choose an effect from the details panel.
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ol className="grid gap-1.5">
            {orderedEffects.map(({ uuid, effect }, index) => {
              const metadata = EFFECT_METADATA_BY_TYPE[effect.type];
              const isSelected = selected === uuid;
              const isDragging = draggingId === uuid;

              return (
                <li
                  key={uuid}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", uuid);
                    draggingIdRef.current = uuid;
                    lastDragTargetRef.current = null;
                    setDraggingId(uuid);
                  }}
                  onDragEnd={endDrag}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    moveDraggingEffect(uuid);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveDraggingEffect(uuid);
                    endDrag();
                  }}
                  className={cn(
                    "rounded-md border bg-background transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted/60",
                    isDragging && "opacity-50",
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2"
                    onClick={() => setSelected(uuid)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelected(uuid);
                      }
                    }}
                  >
                    <GripVertical
                      size={15}
                      className="cursor-grab text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {metadata.name}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {EFFECT_CATEGORY_LABELS[metadata.category]}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        size="sm"
                        checked={effect.enabled}
                        aria-label={`Toggle ${metadata.name}`}
                        onCheckedChange={(checked) =>
                          setEffect(uuid, {
                            enabled: Boolean(checked),
                          } as Partial<typeof effect>)
                        }
                        onClick={(event) => event.stopPropagation()}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Duplicate effect"
                        onClick={(event) => {
                          event.stopPropagation();
                          duplicateEffect(uuid);
                        }}
                      >
                        <CopyIcon size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete effect"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(uuid);
                        }}
                      >
                        <Trash2Icon size={13} />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};
