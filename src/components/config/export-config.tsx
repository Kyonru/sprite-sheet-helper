import { useSharedContext } from "@/context/sharedContext";
import type { ExportFormat } from "@/types/file";
import { folder, useControls } from "leva";
import { useEffect, useMemo } from "react";
import { carousel } from "../leva/carousel";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";

const FrameConfig = () => {
  const heightDefault = useSettingsStore((state) => state.height);
  const widthDefault = useSettingsStore((state) => state.width);
  const setHeight = useSettingsStore((state) => state.setHeight);
  const setWidth = useSettingsStore((state) => state.setWidth);
  const exportHeightDefault = useSettingsStore((state) => state.exportHeight);
  const exportWidthDefault = useSettingsStore((state) => state.exportWidth);
  const setExportHeight = useSettingsStore((state) => state.setExportHeight);
  const setExportWidth = useSettingsStore((state) => state.setExportWidth);

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
            },
          ),
          export: folder(
            {
              height: exportHeightDefault,
              width: exportWidthDefault,
            },
            {
              collapsed: true,
            },
          ),
        },
        {
          collapsed: true,
        },
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
  const exportHeightDefault = useSettingsStore((state) => state.exportHeight);
  const exportWidthDefault = useSettingsStore((state) => state.exportWidth);
  const images = useImagesStore((state) => state.images);
  const frameDelayDefault = useImagesStore((state) => state.frameDelay);
  const setFrameDelay = useImagesStore((state) => state.setFrameDelay);
  const exportModeDefault = useSettingsStore((state) => state.mode);
  const setExportMode = useSettingsStore((state) => state.setMode);

  const state = useMemo(
    () => ({
      images: images,
      width: exportWidthDefault,
      height: exportHeightDefault,
    }),
    [exportWidthDefault, images, exportHeightDefault],
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
    [exportHeightDefault, exportWidthDefault],
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
  const intervalsDefault = useImagesStore((state) => state.intervals);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const iterationsDefault = useImagesStore((state) => state.iterations);
  const setIterations = useImagesStore((state) => state.setIterations);
  const previewDefault = useImagesStore((state) => state.preview);
  const setPreview = useImagesStore((state) => state.setPreview);

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
