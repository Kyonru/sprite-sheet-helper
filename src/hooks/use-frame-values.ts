import { useExportOptionsStore } from "@/store/export";

export const useFrameValues = () => {
  const previewHeight = useExportOptionsStore((state) => state.height);
  const previewWidth = useExportOptionsStore((state) => state.width);
  const exportHeight = useExportOptionsStore((state) => state.exportHeight);
  const exportWidth = useExportOptionsStore((state) => state.exportWidth);

  return {
    exportHeight,
    exportWidth,
    previewHeight,
    previewWidth,
  };
};
