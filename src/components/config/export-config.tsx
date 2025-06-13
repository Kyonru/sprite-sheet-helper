import { useSharedContext } from "@/context/sharedContext";
import { useExportOptionsStore } from "@/store/export";
import type { ExportFormat } from "@/types/file";
import { folder, useControls } from "leva";
import { useEffect, useMemo } from "react";
import { carousel } from "../leva/carousel";

const FrameConfig = () => {
  const heightDefault = useExportOptionsStore((state) => state.height);
  const widthDefault = useExportOptionsStore((state) => state.width);
  const setHeight = useExportOptionsStore((state) => state.setHeight);
  const setWidth = useExportOptionsStore((state) => state.setWidth);
  const exportHeightDefault = useExportOptionsStore(
    (state) => state.exportHeight
  );
  const exportWidthDefault = useExportOptionsStore(
    (state) => state.exportWidth
  );
  const setExportHeight = useExportOptionsStore(
    (state) => state.setExportHeight
  );
  const setExportWidth = useExportOptionsStore((state) => state.setExportWidth);

  const { height, width, previewHeight, previewWidth } = useControls({
    editor: folder({
      size: folder(
        {
          preview: folder(
            {
              previewHeight: {
                label: "height",
                value: heightDefault,
              },
              previewWidth: {
                label: "width",
                value: widthDefault,
              },
            },
            {
              collapsed: true,
            }
          ),
          export: folder(
            {
              height: exportHeightDefault,
              width: exportWidthDefault,
            },
            {
              collapsed: true,
            }
          ),
        },
        {
          collapsed: true,
        }
      ),
    }),
  });

  useEffect(() => {
    setHeight(previewHeight);
    setWidth(previewWidth);
  }, [previewHeight, previewWidth, setHeight, setWidth]);

  useEffect(() => {
    setExportHeight(height);
    setExportWidth(width);
  }, [height, width, setExportHeight, setExportWidth]);

  return null;
};

export const PreviewConfig = () => {
  const { levaStore } = useSharedContext();
  const exportHeightDefault = useExportOptionsStore(
    (state) => state.exportHeight
  );
  const exportWidthDefault = useExportOptionsStore(
    (state) => state.exportWidth
  );
  const images = useExportOptionsStore((state) => state.images);
  const frameDelayDefault = useExportOptionsStore((state) => state.frameDelay);
  const exportModeDefault = useExportOptionsStore((state) => state.mode);
  const setExportMode = useExportOptionsStore((state) => state.setMode);
  const setFrameDelay = useExportOptionsStore((state) => state.setFrameDelay);

  const state = useMemo(
    () => ({
      images: images,
      width: exportWidthDefault,
      height: exportHeightDefault,
    }),
    [exportWidthDefault, images, exportHeightDefault]
  );

  const [{ frameDelay, mode }, set] = useControls(
    () => ({
      mode: {
        options: ["zip", "spritesheet", "gif"] as ExportFormat[],
        value: exportModeDefault,
      },
      frameDelay: {
        label: "Delay",
        value: frameDelayDefault,
        min: 1,
        max: 1000,
        step: 1,
      },
      preview: carousel(state),
    }),
    {
      store: levaStore,
    },
    [exportHeightDefault, exportWidthDefault]
  );

  useEffect(() => {
    setFrameDelay(frameDelay);
  }, [frameDelay, setFrameDelay]);

  useEffect(() => {
    set({
      preview: {
        images: state.images,
        width: exportWidthDefault,
        height: exportHeightDefault,
      },
    });
  }, [set, exportHeightDefault, exportWidthDefault, state]);

  useEffect(() => {
    set({
      preview: {
        images: images.map((i) => {
          return {
            ...i,
            images: i.images.map((i) => `data:image/png;base64,${i}`),
          };
        }),
        width: state.width,
        height: state.height,
      },
    });
  }, [images, state, set]);

  useEffect(() => {
    setExportMode(mode);
  }, [mode, setExportMode]);

  return null;
};

export const ExportConfig = () => {
  const intervalsDefault = useExportOptionsStore((state) => state.intervals);
  const setIntervals = useExportOptionsStore((state) => state.setIntervals);
  const iterationsDefault = useExportOptionsStore((state) => state.iterations);
  const setIterations = useExportOptionsStore((state) => state.setIterations);
  const previewDefault = useExportOptionsStore((state) => state.preview);
  const setPreview = useExportOptionsStore((state) => state.setPreview);

  const { intervals, count, preview } = useControls({
    editor: folder({
      intervals: intervalsDefault,
      count: iterationsDefault,
      preview: {
        label: "Pixel Grid",
        value: previewDefault,
      },
    }),
  });

  useEffect(() => {
    setIntervals(intervals);
  }, [intervals, setIntervals]);

  useEffect(() => {
    setIterations(count);
  }, [count, setIterations]);

  useEffect(() => {
    setPreview(preview);
  }, [preview, setPreview]);

  return (
    <>
      <FrameConfig />
      <PreviewConfig />
    </>
  );
};
