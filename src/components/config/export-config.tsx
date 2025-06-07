import { useExportOptionsStore } from "@/store/export";
import type { ExportFormat } from "@/types/file";
import { folder, useControls } from "leva";
import { useEffect } from "react";

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
    "export options": folder({
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

export const ExportConfig = () => {
  const exportModeDefault = useExportOptionsStore((state) => state.mode);
  const setExportMode = useExportOptionsStore((state) => state.setMode);
  const intervalsDefault = useExportOptionsStore((state) => state.intervals);
  const setIntervals = useExportOptionsStore((state) => state.setIntervals);
  const iterationsDefault = useExportOptionsStore((state) => state.iterations);
  const setIterations = useExportOptionsStore((state) => state.setIterations);
  const frameDelayDefault = useExportOptionsStore((state) => state.frameDelay);
  const setFrameDelay = useExportOptionsStore((state) => state.setFrameDelay);

  const { mode, intervals, count, frameDelay } = useControls({
    "export options": folder({
      mode: {
        options: ["zip", "spritesheet", "gif"] as ExportFormat[],
        value: exportModeDefault,
      },
      intervals: intervalsDefault,
      count: iterationsDefault,
      frameDelay: {
        value: frameDelayDefault,
        min: 0,
        max: 1000,
        step: 1,
      },
    }),
  });

  useEffect(() => {
    setExportMode(mode);
  }, [mode, setExportMode]);

  useEffect(() => {
    setIntervals(intervals);
  }, [intervals, setIntervals]);

  useEffect(() => {
    setIterations(count);
  }, [count, setIterations]);

  useEffect(() => {
    setFrameDelay(frameDelay);
  }, [frameDelay, setFrameDelay]);

  return (
    <>
      <FrameConfig />
    </>
  );
};
