import { Components } from "leva/plugin";
import {
  CarouselContent,
  CarouselItem,
  Carousel,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "../../ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import {
  CircleEllipsisIcon,
  LucideFullscreen,
  LucideInfinity,
  LucidePlay,
  LucideTrash,
  LucideZoomIn,
  LucideZoomOut,
  PencilIcon,
  PencilRulerIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventType, PubSub } from "@/lib/events";
import Autoplay from "embla-carousel-autoplay";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useImagesStore } from "@/store/next/images";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { confirm } from "@/components/confirm";
import { reorderItems } from "@/components/animation-reorder-modal";
import { addDataToImageIfNeeded } from "@/utils/images";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const { Row } = Components;

type LevaCarouselSettings = { alpha?: number };
type LevaCarouselType = {
  images: Array<{
    uuid: string;
    name?: string;
    label: string;
    images: string[];
    frameWidth: number;
    frameHeight: number;
  }>;
  width: number;
  height: number;
};
export type LevaCarouselInput = LevaCarouselType & LevaCarouselSettings;

const useSelectedSnapDisplay = (emblaApi: CarouselApi) => {
  const [selectedSnap, setSelectedSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  const updateScrollSnapState = useCallback((emblaApi: CarouselApi) => {
    if (!emblaApi) return;

    setSnapCount(emblaApi.scrollSnapList().length);
    setSelectedSnap(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    updateScrollSnapState(emblaApi);
    emblaApi.on("select", updateScrollSnapState);
    emblaApi.on("reInit", updateScrollSnapState);
  }, [emblaApi, updateScrollSnapState]);

  return {
    selectedSnap,
    snapCount,
  };
};

type UseAutoplayType = {
  autoplayIsPlaying: boolean;
  toggleAutoplay: () => void;
  onAutoplayButtonClick: (callback: () => void) => void;
};

const useAutoplay = (emblaApi: CarouselApi | undefined): UseAutoplayType => {
  const [autoplayIsPlaying, setAutoplayIsPlaying] = useState(false);

  const onAutoplayButtonClick = useCallback(
    (callback: () => void) => {
      const autoplay = emblaApi?.plugins()?.autoplay;
      if (!autoplay) return;

      const resetOrStop =
        autoplay.options.stopOnInteraction === false
          ? autoplay.reset
          : autoplay.stop;

      resetOrStop();
      callback();
    },
    [emblaApi],
  );

  const toggleAutoplay = useCallback(() => {
    const autoplay = emblaApi?.plugins()?.autoplay;
    if (!autoplay) return;

    const playOrStop = autoplay.isPlaying() ? autoplay.stop : autoplay.play;
    playOrStop();
  }, [emblaApi]);

  useEffect(() => {
    const autoplay = emblaApi?.plugins()?.autoplay;
    if (!autoplay) return;

    setAutoplayIsPlaying(autoplay.isPlaying());
    emblaApi
      .on("autoplay:play", () => setAutoplayIsPlaying(true))
      .on("autoplay:stop", () => setAutoplayIsPlaying(false))
      .on("reInit", () => setAutoplayIsPlaying(autoplay.isPlaying()));
  }, [emblaApi]);

  return {
    autoplayIsPlaying,
    toggleAutoplay,
    onAutoplayButtonClick,
  };
};

const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-2 left-2 z-10">
      <LucideZoomIn className="mb-2 text-chart-3" onClick={() => zoomIn()} />
      <LucideZoomOut className="mb-2 text-chart-3" onClick={() => zoomOut()} />
      <LucideFullscreen
        className="text-chart-3"
        onClick={() => resetTransform()}
      />
    </div>
  );
};

const CarrouselRow = ({
  images,
  name,
  label,
  selected,
  onClick,
}: {
  images: string[];
  name: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      className={`flex flex-row w-full h-10 gap-2 items-center pl-2 pr-2 rounded-md ${
        selected ? "border-2 border-chart-3" : ""
      }`}
      onClick={onClick}
    >
      <RadioGroupItem checked={selected} value={name} id={name} />
      <Label className="w-24 text-ellipsis truncate" htmlFor="option-two">
        {label}
      </Label>
      <div className="relative h-10 flex flex-1 gap-2 overflow-hidden">
        {images?.slice(0, 10).map(
          (imageSrc, i) =>
            imageSrc && (
              <img
                style={{
                  opacity: 2 * (1 / (i + 1)),
                  transform: `translateX(${i * 45}%)`,
                }}
                key={`${name}-${i}`}
                className={`h-10 w-10 rounded-md absolute object-contain`}
                src={addDataToImageIfNeeded(imageSrc)}
                alt={`Frame ${i}`}
              />
            ),
        )}
      </div>
    </div>
  );
};

const CarouselAnimatedRowContent = ({
  onRemove,
  index,
  src,
  selectedSnap,
  className,
}: {
  onRemove: () => void;
  index: number;
  src: string;
  selectedSnap: number;
  className?: string;
}) => {
  return (
    <div className={className}>
      <img
        className={`h-10 w-10 rounded-md ${
          index === selectedSnap ? "border-2 border-chart-3" : ""
        }`}
        src={addDataToImageIfNeeded(src)}
        alt={`Frame ${index}`}
      />
      <div className="absolute flex size-10 top-0 right-0 items-center justify-center group">
        <LucideTrash
          onClick={onRemove}
          className="size-5 active:size-3 self-center text-chart-3 hidden group-hover:flex transition-all duration-200"
        />
      </div>
    </div>
  );
};

// Could be reused for others, but for now it's just for exporting
export const LevaCarousel = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [exporting, setExporting] = useState(false);

  const { selectedSnap, snapCount } = useSelectedSnapDisplay(api);
  const { autoplayIsPlaying, toggleAutoplay } = useAutoplay(api);
  const [loop, setLoop] = useState(false);

  const frameDelay = useImagesStore((state) => state.fps);
  const selectedRow = useImagesStore((state) => state.selectedRow);
  const removeImagesRow = useImagesStore((state) => state.removeImagesRow);
  const updateLabel = useImagesStore((state) => state.updateLabel);
  const updateWidth = useImagesStore((state) => state.updateWidth);
  const updateHeight = useImagesStore((state) => state.updateHeight);
  const updateFps = useImagesStore((state) => state.updateFps);
  const setSelectedRow = useImagesStore((state) => state.setSelectedRow);
  const images = useImagesStore((state) => state.images);

  const removeImageFromRow = useImagesStore(
    (state) => state.removeImageFromRow,
  );

  const updateImagesRow = useImagesStore((state) => state.updateImagesRow);

  const onTogglePlay = useCallback(() => {
    toggleAutoplay();
  }, [toggleAutoplay]);

  const onRemoveRow = useCallback(
    (index: number) => {
      setSelectedRow(0);
      removeImagesRow(index);
    },
    [removeImagesRow, setSelectedRow],
  );

  const onRemoveImageFromRow = useCallback(
    (index: number, imageIndex: number) => {
      removeImageFromRow(index, imageIndex);
    },
    [removeImageFromRow],
  );

  const onExport = useCallback(() => {
    PubSub.emit(EventType.START_EXPORT);
    setExporting(true);
    console.log("Exporting");
  }, []);

  const onToggleLoop = useCallback(() => {
    setLoop((loop) => !loop);
  }, []);

  useEffect(() => {
    const stopExporting = () => {
      setExporting(false);
    };

    PubSub.on(EventType.STOP_EXPORT, stopExporting);
    PubSub.on(EventType.STOP_ASSETS_CREATION, stopExporting);
    return () => {
      PubSub.off(EventType.STOP_EXPORT, stopExporting);
      PubSub.off(EventType.STOP_ASSETS_CREATION, stopExporting);
    };
  }, []);

  const imagesLength = useMemo(() => {
    const displayedImages = images[selectedRow]?.images;

    if (!displayedImages) return 0;

    if (displayedImages.length > 6 || displayedImages.length <= 1) {
      return displayedImages.length;
    }

    if (displayedImages.length === 2) {
      return 1;
    }

    return 2;
  }, [images, selectedRow]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <Row className="max-h-40 pr-2 pb-4 overflow-y-scroll pt-2">
        <RadioGroup>
          {images.map((row, index) => (
            <div
              key={index}
              className="flex flex-row items-center cursor-pointer"
            >
              <CarrouselRow
                images={row.images}
                name={row.label || ""}
                label={row.label}
                selected={selectedRow === index}
                onClick={() => {
                  setSelectedRow(index);
                }}
              />
              <div className="flex justify-center items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <CircleEllipsisIcon className="ml-2 hover:text-chart-3 active:size-4 size-6 active:animate-in transition-all duration-200" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-9999">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() =>
                          confirm.withInput("Rename sequence", {
                            input: {
                              label: "Sequence name",
                              placeholder: "Sequence name…",
                              defaultValue: row.label,
                            },
                            onConfirm: (value) =>
                              updateLabel(row.uuid, value || row.label), // value: string
                          })
                        }
                      >
                        <PencilIcon />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          reorderItems({
                            items: row.images.map((v, i) => {
                              return {
                                src: v,
                                id: i,
                              };
                            }),
                            onChange: (items) =>
                              updateImagesRow(
                                index,
                                items.map((i) => i.src),
                              ),
                            onRenderItem: (item) => (
                              <img
                                key={`${item.id}`}
                                className={`h-24 w-24 rounded-md object-contain`}
                                src={addDataToImageIfNeeded(item.src)}
                                alt={`Frame ${item.id}`}
                              />
                            ),
                            header: (
                              <form>
                                <FieldGroup>
                                  <Field>
                                    <Label htmlFor="name-1">Name</Label>
                                    <Input
                                      id="name-1"
                                      name="name"
                                      defaultValue={row.label}
                                      onChange={(e) =>
                                        updateLabel(row.uuid, e.target.value)
                                      }
                                    />
                                  </Field>
                                  <div className="grid grid-cols-3 gap-4">
                                    <Field>
                                      <Label htmlFor="width-1">Width</Label>
                                      <Input
                                        id="width-1"
                                        name="width"
                                        defaultValue={row.frameWidth}
                                        type="number"
                                        onChange={(e) =>
                                          updateWidth(row.uuid, +e.target.value)
                                        }
                                      />
                                    </Field>
                                    <Field>
                                      <Label htmlFor="height-1">Height</Label>
                                      <Input
                                        id="height-1"
                                        name="height"
                                        defaultValue={row.frameHeight}
                                        type="number"
                                        onChange={(e) =>
                                          updateHeight(
                                            row.uuid,
                                            +e.target.value,
                                          )
                                        }
                                      />
                                    </Field>
                                    <Field>
                                      <Label htmlFor="fps-1">FPS</Label>
                                      <Input
                                        id="fps-1"
                                        name="fps"
                                        defaultValue={row.fps}
                                        type="number"
                                        min={1}
                                        max={240}
                                        onChange={(e) =>
                                          updateFps(row.uuid, +e.target.value)
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
                        <PencilRulerIcon />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          confirm.delete(row.label, {
                            onConfirm: () => onRemoveRow(index),
                          })
                        }
                      >
                        <TrashIcon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </RadioGroup>
      </Row>
      <Row>
        <div draggable={false} className="flex flex-col gap-2 mb-2">
          <Card className="p-0 justify-center items-center">
            <CardContent className="flex aspect-square w-80 h-80 p-0">
              <TransformWrapper
                maxScale={50}
                pinch={{
                  step: 100,
                }}
              >
                <ZoomControls />
                <TransformComponent
                  wrapperStyle={{
                    width: "100%",
                    height: "100%",
                    alignSelf: "center",
                  }}
                  wrapperClass="items-center justify-center"
                >
                  <div className="flex">
                    <img
                      className="align-middle"
                      style={{
                        width: images[selectedRow]?.frameWidth,
                        height: images[selectedRow]?.frameHeight,
                        imageRendering: "pixelated",
                      }}
                      src={addDataToImageIfNeeded(
                        images?.[selectedRow]?.images?.[selectedSnap] || "",
                      )}
                      alt="Picture"
                    />
                  </div>
                </TransformComponent>
              </TransformWrapper>
              <ToggleGroup
                className="absolute top-2 right-2 z-99"
                type="single"
                value={autoplayIsPlaying ? "on" : "off"}
                onValueChange={onTogglePlay}
              >
                <ToggleGroupItem value="on" aria-label="on">
                  <LucidePlay className="size-6" />
                </ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                className="absolute top-12 right-2 z-99"
                type="single"
                value={loop ? "on" : "off"}
                onValueChange={onToggleLoop}
              >
                <ToggleGroupItem value="on" aria-label="on">
                  <LucideInfinity className="size-6" />
                </ToggleGroupItem>
              </ToggleGroup>
            </CardContent>
          </Card>
          <Carousel
            opts={{
              dragFree: true,
              startIndex: 0,
              loop: true,
            }}
            plugins={[
              // TODO: Make my own autoplay or Use carousel as frame display with watchDrag = false
              Autoplay({
                delay: frameDelay,
                playOnInit: false,
                stopOnInteraction: true,
                stopOnLastSnap: !loop,
              }),
            ]}
            setApi={setApi}
            className="w-full flex flex-row"
          >
            <CarouselPrevious />
            <CarouselContent className="w-[90%]">
              {(images[selectedRow]?.images || []).map((imageSrc, index) => (
                <CarouselItem
                  className={`${
                    imagesLength > 2 ? `basis-1/${imagesLength}` : ""
                  }`}
                  key={index}
                >
                  <CarouselAnimatedRowContent
                    key={index}
                    onRemove={() => onRemoveImageFromRow(selectedRow, index)}
                    index={index}
                    src={imageSrc}
                    selectedSnap={selectedSnap}
                    className={`relative`}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselNext />
          </Carousel>
          {imagesLength <= 2 && (
            <div className="flex flex-row w-full h-10 gap-2 items-center pl-2 pr-2 rounded-md">
              {(images[selectedRow]?.images || []).map((imageSrc, index) => (
                <CarouselAnimatedRowContent
                  key={index}
                  onRemove={() => {
                    onRemoveImageFromRow(selectedRow, index);
                  }}
                  index={index}
                  src={imageSrc}
                  selectedSnap={selectedSnap}
                  className={`relative ${
                    imagesLength > 2 ? `basis-1/${imagesLength}` : ""
                  }`}
                />
              ))}
            </div>
          )}
          <div className="flex flex-row justify-center">
            <div className="text-muted-foreground py-2 text-center text-sm">
              Frame {selectedSnap + 1} of {snapCount}
            </div>
          </div>

          <Button
            className="bg-chart-2 text-primary-foreground"
            disabled={exporting}
            onClick={onExport}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </Row>
    </>
  );
};
