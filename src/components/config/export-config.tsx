import { useSharedContext } from "@/context/sharedContext";
import { ExportFormats, type ExportFormat } from "@/types/file";
import { button, folder, useControls } from "leva";
import { useEffect } from "react";
import { carousel } from "../leva/carousel";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import { EventType, PubSub } from "@/lib/events";

export const ExportConfig = () => {
  const { levaStore } = useSharedContext();
  const exportHeightDefault = useSettingsStore((state) => state.exportHeight);
  const exportWidthDefault = useSettingsStore((state) => state.exportWidth);
  const fpsDefault = useImagesStore((state) => state.fps);
  const setFPS = useImagesStore((state) => state.setFPS);
  const intervalsDefault = useImagesStore((state) => state.intervals);
  const iterationsDefault = useImagesStore((state) => state.iterations);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const setIterations = useImagesStore((state) => state.setIterations);
  const exportModeDefault = useSettingsStore((state) => state.mode);
  const setExportMode = useSettingsStore((state) => state.setMode);

  const heightDefault = useSettingsStore((state) => state.height);
  const widthDefault = useSettingsStore((state) => state.width);
  const setHeight = useSettingsStore((state) => state.setHeight);
  const setWidth = useSettingsStore((state) => state.setWidth);
  const setExportHeight = useSettingsStore((state) => state.setExportHeight);
  const setExportWidth = useSettingsStore((state) => state.setExportWidth);

  const [
    {
      fps,
      mode,
      intervals,
      iterations,
      height,
      width,
      previewHeight,
      previewWidth,
    },
    set,
  ] = useControls(
    () => ({
      "Sequence Options": folder(
        {
          intervals: {
            label: "Time between frames",
            value: intervalsDefault,
            min: 1,
            max: 1000,
            step: 1,
          },
          iterations: {
            label: "Frames amount",
            value: iterationsDefault,
            min: 1,
            max: 100,
            step: 1,
          },

          "Record Sequence": button(() => {
            PubSub.emit(EventType.START_ASSETS_CREATION);
          }, {}),

          "Add Frame to Sequence": button(() => {
            PubSub.emit(EventType.TAKE_SINGLE_SCREENSHOT);
          }, {}),

          "New Empty Sequence": button(() => {
            PubSub.emit(EventType.NEW_SEQUENCE);
          }, {}),
        },
        {
          color: "var(--chart-2)",
        },
      ),

      "Default Sizes": folder(
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
          color: "var(--chart-3)",
        },
      ),

      "Export Options": folder(
        {
          mode: {
            options: ExportFormats,
            value: exportModeDefault,
          },
          fps: {
            label: "Frame duration",
            value: fpsDefault,
            min: 1,
            max: 1000,
            step: 1,
          },
          preview: carousel(),
        },
        {
          color: "var(--chart-4)",
        },
      ),
    }),
    {
      store: levaStore,
    },
    [exportHeightDefault, exportWidthDefault],
  );

  useEffect(() => {
    setFPS(fps);
  }, [fps, setFPS]);

  useEffect(() => {
    setIntervals(intervals);
  }, [intervals, setIntervals]);

  useEffect(() => {
    setIterations(iterations);
  }, [iterations, setIterations]);

  useEffect(() => {
    set({
      preview: {
        // @ts-expect-error 🤷 Preview type is broken
        width: exportWidthDefault,
        height: exportHeightDefault,
      },
    });
  }, [set, exportHeightDefault, exportWidthDefault]);

  useEffect(() => {
    setExportMode(mode as ExportFormat);
  }, [mode, setExportMode]);

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
