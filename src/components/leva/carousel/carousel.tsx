import { useInputContext, type LevaInputProps, Components } from "leva/plugin";
import {
  CarouselContent,
  CarouselItem,
  Carousel,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "../../ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import {
  LucideFullscreen,
  LucideInfinity,
  LucidePlay,
  LucideZoomIn,
  LucideZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventType, PubSub } from "@/lib/events";
import Autoplay from "embla-carousel-autoplay";
import { useExportOptionsStore } from "@/store/export";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const { Row } = Components;

type LevaCarouselSettings = { alpha?: number };
type LevaCarouselType = {
  images: string[];
  width: number;
  height: number;
};
export type LevaCarouselInput = LevaCarouselType & LevaCarouselSettings;

type LevaCarouselProps = LevaInputProps<
  LevaCarouselType,
  LevaCarouselSettings,
  string
>;

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
    [emblaApi]
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
    <div className="relative">
      <div className="absolute top-2 left-2 w-full h-full bg-black bg-opacity-50 z-10">
        <LucideZoomIn className="mb-2 text-chart-3" onClick={() => zoomIn()} />
        <LucideZoomOut
          className="mb-2 text-chart-3"
          onClick={() => zoomOut()}
        />
        <LucideFullscreen
          className="text-chart-3"
          onClick={() => resetTransform()}
        />
      </div>
    </div>
  );
};

// Could be reused for others, but for now it's just for exporting
export const LevaCarousel = () => {
  const props = useInputContext<LevaCarouselProps>();
  const [api, setApi] = useState<CarouselApi>();
  const [exporting, setExporting] = useState(false);

  const {
    value: { images = [], width, height },
  } = props;

  const { selectedSnap, snapCount } = useSelectedSnapDisplay(api);
  const { autoplayIsPlaying, toggleAutoplay } = useAutoplay(api);
  const [loop, setLoop] = useState(false);

  const frameDelay = useExportOptionsStore((state) => state.frameDelay);

  const onExport = useCallback(() => {
    PubSub.emit(EventType.START_EXPORT);
    setExporting(true);
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

  if (images.length === 0) {
    return null;
  }

  return (
    <Row>
      <div
        draggable={false}
        className="flex flex-col w-full gap-2 max-w-xs mb-2"
      >
        <Card className="p-0">
          <CardContent className="flex aspect-square p-0">
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
                }}
                wrapperClass="items-center justify-center"
              >
                <div className="flex">
                  <img
                    className="align-middle"
                    style={{
                      width: width,
                      height: height,
                    }}
                    src={images[selectedSnap]}
                    alt="Picture"
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          </CardContent>
        </Card>
        <Carousel
          opts={{
            dragFree: true,
            startIndex: 0,
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: frameDelay,
              playOnInit: false,
              stopOnInteraction: true,
              stopOnLastSnap: !loop,
            }),
          ]}
          setApi={setApi}
          className="w-full"
        >
          <CarouselContent className="w-full">
            {images.map((imageSrc, index) => (
              <CarouselItem className="basis-1/5" key={index}>
                <img
                  className={`h-10 w-10 rounded-md ${
                    index === selectedSnap ? "border-2 border-chart-3" : ""
                  }`}
                  src={imageSrc}
                  alt={`Frame ${index}`}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        <div className="flex flex-row justify-center">
          <div className="text-muted-foreground py-2 text-center text-sm">
            Frame {selectedSnap + 1} of {snapCount}
          </div>
          <div></div>
          <ToggleGroup
            className="absolute top-2 right-2"
            type="single"
            value={autoplayIsPlaying ? "on" : "off"}
            onValueChange={toggleAutoplay}
          >
            <ToggleGroupItem value="on" aria-label="on">
              <LucidePlay className="size-6" />
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            className="absolute top-12 right-2"
            type="single"
            value={loop ? "on" : "off"}
            onValueChange={onToggleLoop}
          >
            <ToggleGroupItem value="on" aria-label="on">
              <LucideInfinity className="size-6" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Button disabled={exporting} onClick={onExport}>
          Export
        </Button>
      </div>
    </Row>
  );
};
