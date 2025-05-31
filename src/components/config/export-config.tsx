import { useExportOptionsStore } from "@/store/export";
import type { ExportFormat } from "@/types/file";
import { folder, useControls } from "leva";
import { useEffect } from "react";

const FrameConfig = () => {
  const heightDefault = useExportOptionsStore((state) => state.height);
  const widthDefault = useExportOptionsStore((state) => state.width);
  const setHeight = useExportOptionsStore((state) => state.setHeight);
  const setWidth = useExportOptionsStore((state) => state.setWidth);

  const { height, width } = useControls({
    "export options": folder({
      size: folder(
        {
          height: heightDefault,
          width: widthDefault,
        },
        {
          collapsed: true,
        }
      ),
    }),
  });

  useEffect(() => {
    setHeight(height);
    setWidth(width);
  }, [height, width, setHeight, setWidth]);

  return null;
};

export const ExportConfig = () => {
  const exportModeDefault = useExportOptionsStore((state) => state.mode);
  const setExportMode = useExportOptionsStore((state) => state.setMode);
  const intervalsDefault = useExportOptionsStore((state) => state.intervals);
  const setIntervals = useExportOptionsStore((state) => state.setIntervals);
  const iterationsDefault = useExportOptionsStore((state) => state.iterations);
  const setIterations = useExportOptionsStore((state) => state.setIterations);

  const { mode, intervals, count } = useControls({
    "export options": folder({
      mode: {
        options: ["zip", "spritesheet"] as ExportFormat[],
        value: exportModeDefault,
      },
      intervals: intervalsDefault,
      count: iterationsDefault,
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

  return (
    <>
      <FrameConfig />
    </>
  );
};
