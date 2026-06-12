import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Infinity as InfinityIcon,
  Maximize2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  SlidersHorizontal,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirm } from "@/components/confirm";
import { reorderItems } from "@/components/animation-reorder-modal";
import { useImagesStore } from "@/store/next/images";
import { addDataToImageIfNeeded } from "@/utils/images";
import {
  getNormalCoverageForRow,
  type NormalCoverageStatus,
} from "@/utils/exports/helpers";
import { cn } from "@/lib/utils";

function NormalStatusBadge({ status }: { status: NormalCoverageStatus }) {
  const label =
    status === "ready" ? "Ready" : status === "partial" ? "Partial" : "Missing";

  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px]",
        status === "ready" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        status === "partial" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700",
        status === "missing" &&
          "border-muted-foreground/20 bg-muted text-muted-foreground",
      )}
    >
      Normals: {label}
    </span>
  );
}

function FrameThumbnail({
  src,
  index,
  selected,
  onSelect,
  onRemove,
  buttonRef,
}: {
  src: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <div className="group relative size-10 shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "size-10 overflow-hidden rounded-md border bg-muted/40 transition-colors",
          selected ? "border-primary" : "border-border hover:border-primary/60",
        )}
        onClick={onSelect}
        aria-label={`Select frame ${index + 1}`}
      >
        <img
          className="size-full object-contain"
          src={addDataToImageIfNeeded(src)}
          alt={`Frame ${index + 1}`}
        />
      </button>
      <button
        type="button"
        className="absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full border bg-background text-destructive shadow-sm group-hover:flex"
        onClick={onRemove}
        aria-label={`Delete frame ${index + 1}`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function SequenceRow({
  row,
  index,
  selected,
  onSelect,
  onRemove,
}: {
  row: ReturnType<typeof useImagesStore.getState>["images"][number];
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const updateLabel = useImagesStore((state) => state.updateLabel);
  const updateWidth = useImagesStore((state) => state.updateWidth);
  const updateHeight = useImagesStore((state) => state.updateHeight);
  const updateFps = useImagesStore((state) => state.updateFps);
  const updateImagesRow = useImagesStore((state) => state.updateImagesRow);
  const normalStatus = getNormalCoverageForRow(row).status;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn(
          "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
          selected ? "border-primary bg-primary/10" : "hover:bg-muted",
        )}
        onClick={onSelect}
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{row.label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {row.images.length} frame{row.images.length === 1 ? "" : "s"} ·{" "}
            {row.frameWidth}x{row.frameHeight}
          </div>
        </div>
        <NormalStatusBadge status={normalStatus} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label={`Sequence actions for ${row.label}`}
          >
            <MoreHorizontal size={15} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-9999">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() =>
                confirm.withInput("Rename sequence", {
                  input: {
                    label: "Sequence name",
                    placeholder: "Sequence name...",
                    defaultValue: row.label,
                  },
                  onConfirm: (value) =>
                    updateLabel(row.uuid, value || row.label),
                })
              }
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                reorderItems({
                  items: row.images.map((src, frameIndex) => ({
                    src,
                    id: frameIndex,
                  })),
                  onChange: (items) =>
                    updateImagesRow(
                      index,
                      items.map((item) => item.src),
                      row.normalImages
                        ? items.map((item) => row.normalImages![item.id])
                        : undefined,
                    ),
                  onRenderItem: (item) => (
                    <img
                      key={`${item.id}`}
                      className="size-24 rounded-md object-contain"
                      src={addDataToImageIfNeeded(item.src)}
                      alt={`Frame ${item.id + 1}`}
                    />
                  ),
                  header: (
                    <form onSubmit={(event) => event.preventDefault()}>
                      <FieldGroup>
                        <Field>
                          <Label htmlFor={`sequence-name-${row.uuid}`}>
                            Name
                          </Label>
                          <Input
                            id={`sequence-name-${row.uuid}`}
                            name="name"
                            defaultValue={row.label}
                            onChange={(event) =>
                              updateLabel(row.uuid, event.target.value)
                            }
                          />
                        </Field>
                        <div className="grid grid-cols-3 gap-4">
                          <Field>
                            <Label htmlFor={`sequence-width-${row.uuid}`}>
                              Width
                            </Label>
                            <Input
                              id={`sequence-width-${row.uuid}`}
                              name="width"
                              defaultValue={row.frameWidth}
                              type="number"
                              min={1}
                              onChange={(event) =>
                                updateWidth(row.uuid, Number(event.target.value))
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor={`sequence-height-${row.uuid}`}>
                              Height
                            </Label>
                            <Input
                              id={`sequence-height-${row.uuid}`}
                              name="height"
                              defaultValue={row.frameHeight}
                              type="number"
                              min={1}
                              onChange={(event) =>
                                updateHeight(
                                  row.uuid,
                                  Number(event.target.value),
                                )
                              }
                            />
                          </Field>
                          <Field>
                            <Label htmlFor={`sequence-fps-${row.uuid}`}>
                              FPS
                            </Label>
                            <Input
                              id={`sequence-fps-${row.uuid}`}
                              name="fps"
                              defaultValue={row.fps}
                              type="number"
                              min={1}
                              max={240}
                              onChange={(event) =>
                                updateFps(row.uuid, Number(event.target.value))
                              }
                            />
                          </Field>
                        </div>
                      </FieldGroup>
                    </form>
                  ),
                });
              }}
            >
              <SlidersHorizontal />
              Edit frames
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirm.delete(row.label, {
                  onConfirm: onRemove,
                })
              }
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SequencePreview() {
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const rows = useImagesStore((state) => state.images);
  const selectedRow = useImagesStore((state) => state.selectedRow);
  const setSelectedRow = useImagesStore((state) => state.setSelectedRow);
  const setImages = useImagesStore((state) => state.setImages);
  const removeImagesRow = useImagesStore((state) => state.removeImagesRow);
  const removeImageFromRow = useImagesStore(
    (state) => state.removeImageFromRow,
  );
  const [open, setOpen] = useState(() => rows.length > 0);
  const hadRowsRef = useRef(rows.length > 0);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!hadRowsRef.current && rows.length > 0) {
      setOpen(true);
    }
    hadRowsRef.current = rows.length > 0;
  }, [rows.length]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (selectedRow < rows.length) return;
    setSelectedRow(Math.max(0, rows.length - 1));
  }, [rows.length, selectedRow, setSelectedRow]);

  const activeRow = rows[selectedRow] ?? rows[0];
  const currentFrameIndex = activeRow
    ? Math.max(0, Math.min(activeFrameIndex, activeRow.images.length - 1))
    : 0;
  const currentFrame = activeRow?.images[currentFrameIndex];
  const totalFrames = useMemo(
    () => rows.reduce((sum, row) => sum + row.images.length, 0),
    [rows],
  );

  useEffect(() => {
    setPlaying(false);
    setActiveFrameIndex(0);
    thumbnailRefs.current = [];
  }, [activeRow?.uuid]);

  useEffect(() => {
    if (!activeRow) return;
    setActiveFrameIndex((index) =>
      Math.max(0, Math.min(index, activeRow.images.length - 1)),
    );
  }, [activeRow]);

  useEffect(() => {
    thumbnailRefs.current[currentFrameIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: playing ? "auto" : "smooth",
    });
  }, [activeRow?.uuid, currentFrameIndex, playing]);

  useEffect(() => {
    if (!playing || !activeRow || activeRow.images.length <= 1) return;

    const playbackDelay = Math.max(
      16,
      Math.round(1000 / Math.max(1, activeRow.fps || 12)),
    );
    const timeoutId = window.setTimeout(() => {
      setActiveFrameIndex((index) => {
        const nextIndex = index + 1;
        if (nextIndex < activeRow.images.length) return nextIndex;
        if (loop) return 0;
        setPlaying(false);
        return index;
      });
    }, playbackDelay);

    return () => window.clearTimeout(timeoutId);
  }, [activeFrameIndex, activeRow, loop, playing]);

  const removeRow = useCallback(
    (index: number) => {
      const nextSelected =
        index === selectedRow
          ? Math.max(0, selectedRow - 1)
          : index < selectedRow
            ? Math.max(0, selectedRow - 1)
            : selectedRow;

      setSelectedRow(Math.min(nextSelected, Math.max(0, rows.length - 2)));
      removeImagesRow(index);
    },
    [removeImagesRow, rows.length, selectedRow, setSelectedRow],
  );

  const removeFrame = useCallback(
    (frameIndex: number) => {
      if (!activeRow) return;
      removeImageFromRow(selectedRow, frameIndex);
      setActiveFrameIndex((index) => {
        const nextLength = activeRow.images.length - 1;
        if (nextLength <= 0) return 0;
        if (frameIndex < index) return index - 1;
        return Math.min(index, nextLength - 1);
      });
    },
    [activeRow, removeImageFromRow, selectedRow],
  );

  const removeAllRows = useCallback(() => {
    confirm.delete("all rows", {
      onConfirm: () => {
        setImages([]);
        setSelectedRow(0);
        setPlaying(false);
        setActiveFrameIndex(0);
      },
    });
  }, [setImages, setPlaying, setActiveFrameIndex, setSelectedRow]);

  const selectPreviousFrame = useCallback(() => {
    if (!activeRow || activeRow.images.length <= 1) return;
    setPlaying(false);
    setActiveFrameIndex((index) =>
      index > 0 ? index - 1 : loop ? activeRow.images.length - 1 : 0,
    );
  }, [activeRow, loop]);

  const selectNextFrame = useCallback(() => {
    if (!activeRow || activeRow.images.length <= 1) return;
    setPlaying(false);
    setActiveFrameIndex((index) =>
      index + 1 < activeRow.images.length ? index + 1 : loop ? 0 : index,
    );
  }, [activeRow, loop]);

  return (
    <section className="mt-3 rounded-md border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm font-medium"
          >
            <span>Sequence Preview</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {rows.length} row{rows.length === 1 ? "" : "s"} · {totalFrames}{" "}
              frame{totalFrames === 1 ? "" : "s"}
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {rows.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Captured sequences will appear here.
            </div>
          ) : (
            <div className="grid gap-3 p-3">
              <div className="grid max-h-40 gap-1 overflow-auto pr-1">
                {rows.map((row, index) => (
                  <SequenceRow
                    key={row.uuid}
                    row={row}
                    index={index}
                    selected={selectedRow === index}
                    onSelect={() => setSelectedRow(index)}
                    onRemove={() => removeRow(index)}
                  />
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-max justify-self-end text-xs"
                onClick={removeAllRows}
              >
                <Trash2 size={12} />
                Delete all rows
              </Button>

              <div className="relative rounded-md border bg-muted/20">
                <div className="mx-auto aspect-square w-full max-w-80">
                  {currentFrame ? (
                    <TransformWrapper
                      key={activeRow?.uuid}
                      maxScale={50}
                      wheel={{ step: 0.08 }}
                    >
                      {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                          <div className="absolute left-2 top-2 z-10 flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="size-7"
                              onClick={() => zoomIn()}
                              aria-label="Zoom in"
                            >
                              <ZoomIn size={14} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="size-7"
                              onClick={() => zoomOut()}
                              aria-label="Zoom out"
                            >
                              <ZoomOut size={14} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="size-7"
                              onClick={() => resetTransform()}
                              aria-label="Reset zoom"
                            >
                              <Maximize2 size={14} />
                            </Button>
                          </div>
                          <div className="absolute right-2 top-2 z-10 flex gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant={playing ? "secondary" : "outline"}
                              className="size-7"
                              onClick={() => setPlaying((value) => !value)}
                              disabled={(activeRow?.images.length ?? 0) <= 1}
                              aria-pressed={playing}
                              aria-label="Play sequence"
                            >
                              {playing ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant={loop ? "secondary" : "outline"}
                              className="size-7"
                              onClick={() => setLoop((value) => !value)}
                              aria-pressed={loop}
                              aria-label="Loop sequence"
                            >
                              <InfinityIcon size={14} />
                            </Button>
                          </div>
                          <TransformComponent
                            wrapperStyle={{
                              width: "100%",
                              height: "100%",
                            }}
                            wrapperClass="items-center justify-center"
                          >
                            <div
                              className="relative max-h-full max-w-full"
                              style={{
                                width: activeRow?.frameWidth,
                                height: activeRow?.frameHeight,
                                imageRendering: "pixelated",
                              }}
                            >
                              {activeRow?.images.map((imageSrc, index) => (
                                <img
                                  key={`${activeRow.uuid}-${index}`}
                                  className={cn(
                                    "absolute inset-0 size-full object-contain",
                                    index === currentFrameIndex
                                      ? "opacity-100"
                                      : "pointer-events-none opacity-0",
                                  )}
                                  style={{ imageRendering: "pixelated" }}
                                  src={addDataToImageIfNeeded(imageSrc)}
                                  alt={`${activeRow.label} frame ${index + 1}`}
                                  draggable={false}
                                />
                              ))}
                            </div>
                          </TransformComponent>
                        </>
                      )}
                    </TransformWrapper>
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      This sequence has no frames.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={selectPreviousFrame}
                  disabled={(activeRow?.images.length ?? 0) <= 1}
                  aria-label="Previous frame"
                >
                  <ChevronLeft size={14} />
                </Button>
                <div className="no-scrollbar min-w-0 overflow-x-auto overflow-y-hidden py-1">
                  <div className="flex w-max gap-1 px-0.5">
                    {(activeRow?.images ?? []).map((imageSrc, index) => (
                      <FrameThumbnail
                        key={index}
                        buttonRef={(node) => {
                          thumbnailRefs.current[index] = node;
                        }}
                        src={imageSrc}
                        index={index}
                        selected={index === currentFrameIndex}
                        onSelect={() => {
                          setPlaying(false);
                          setActiveFrameIndex(index);
                        }}
                        onRemove={() => removeFrame(index)}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  onClick={selectNextFrame}
                  disabled={(activeRow?.images.length ?? 0) <= 1}
                  aria-label="Next frame"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                {activeRow
                  ? `Frame ${Math.min(currentFrameIndex + 1, activeRow.images.length)} of ${activeRow.images.length}`
                  : "No sequence selected"}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
