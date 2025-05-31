import { useExportOptionsStore } from "@/store/export";

export const useFrameValues = () => {
  const height = useExportOptionsStore((state) => state.height);
  const width = useExportOptionsStore((state) => state.width);

  return {
    height,
    width,
  };
};
