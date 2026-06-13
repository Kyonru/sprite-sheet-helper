import { type ExportFormat } from "@/types/file";
import { useMemo } from "react";
import { InspectorPanel, type InspectorField } from "@/components/inspector";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import { EventType, PubSub } from "@/lib/events";
import { exporters } from "@/utils/exports";

export const ExportConfig = () => {
  const exportHeight = useSettingsStore((state) => state.exportHeight);
  const exportWidth = useSettingsStore((state) => state.exportWidth);
  const fps = useImagesStore((state) => state.fps);
  const setFPS = useImagesStore((state) => state.setFPS);
  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const setIterations = useImagesStore((state) => state.setIterations);
  const exportMode = useSettingsStore((state) => state.mode);
  const setExportMode = useSettingsStore((state) => state.setMode);
  const exportNormalMap = useSettingsStore((state) => state.exportNormalMap);
  const setExportNormalMap = useSettingsStore(
    (state) => state.setExportNormalMap,
  );

  const previewHeight = useSettingsStore((state) => state.height);
  const previewWidth = useSettingsStore((state) => state.width);
  const setHeight = useSettingsStore((state) => state.setHeight);
  const setWidth = useSettingsStore((state) => state.setWidth);
  const setExportHeight = useSettingsStore((state) => state.setExportHeight);
  const setExportWidth = useSettingsStore((state) => state.setExportWidth);

  const exportModeOptions = useMemo(
    () =>
      Object.values(exporters).reduce(
        (acc, exporter) => {
          acc[exporter.label] = exporter.id;
          return acc;
        },
        {} as Record<string, ExportFormat>,
      ),
    [],
  );

  const fields = useMemo<InspectorField[]>(
    () => [
      {
        kind: "group",
        label: "Sequence Options",
        fields: [
          {
            kind: "number",
            label: "Time between frames",
            value: intervals,
            min: 1,
            max: 1000,
            step: 1,
            onChange: setIntervals,
          },
          {
            kind: "number",
            label: "Frames amount",
            value: iterations,
            min: 1,
            max: 100,
            step: 1,
            onChange: setIterations,
          },
          {
            kind: "button",
            label: "Record Sequence",
            action: () => PubSub.emit(EventType.START_ASSETS_CREATION),
          },
          {
            kind: "button",
            label: "Add Frame to Sequence",
            action: () => PubSub.emit(EventType.TAKE_SINGLE_SCREENSHOT),
          },
          {
            kind: "button",
            label: "New Empty Sequence",
            action: () => PubSub.emit(EventType.NEW_SEQUENCE),
          },
        ],
      },
      {
        kind: "group",
        label: "Preview Size",
        fields: [
          {
            kind: "number",
            label: "height",
            value: previewHeight,
            onChange: setHeight,
          },
          {
            kind: "number",
            label: "width",
            value: previewWidth,
            onChange: setWidth,
          },
        ],
      },
      {
        kind: "group",
        label: "Export Size",
        fields: [
          {
            kind: "number",
            label: "height",
            value: exportHeight,
            onChange: setExportHeight,
          },
          {
            kind: "number",
            label: "width",
            value: exportWidth,
            onChange: setExportWidth,
          },
        ],
      },
      {
        kind: "group",
        label: "Export Options",
        fields: [
          {
            kind: "select",
            label: "mode",
            options: exportModeOptions,
            value: exportMode,
            onChange: (value) => setExportMode(value as ExportFormat),
          },
          {
            kind: "number",
            label: "Frame duration",
            value: fps,
            min: 1,
            max: 1000,
            step: 1,
            onChange: setFPS,
          },
          {
            kind: "boolean",
            label: "Capture normal maps",
            value: exportNormalMap,
            onChange: setExportNormalMap,
          },
          {
            kind: "readonly",
            label: "Preview",
            value: `${exportWidth}x${exportHeight}`,
          },
        ],
      },
    ],
    [
      exportHeight,
      exportMode,
      exportModeOptions,
      exportNormalMap,
      exportWidth,
      fps,
      intervals,
      iterations,
      previewHeight,
      previewWidth,
      setExportHeight,
      setExportMode,
      setExportNormalMap,
      setExportWidth,
      setFPS,
      setHeight,
      setIntervals,
      setIterations,
      setWidth,
    ],
  );

  return <InspectorPanel fields={fields} />;
};
