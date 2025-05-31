import { SidebarMenuItem } from "@/components/ui/sidebar";
import { LightsConfig } from "./lights-config";
import { EffectsConfig } from "./effects-config";
import { CameraConfig } from "./camera-config";
import { ModelConfig } from "./model-config";
import { ExportConfig } from "./export-config";

export const AssetConfig = () => {
  return (
    <>
      <SidebarMenuItem key={"model"}>
        <ModelConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"camera"}>
        <CameraConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"effects"}>
        <EffectsConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"lighting"}>
        <LightsConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"export"}>
        <ExportConfig />
      </SidebarMenuItem>
    </>
  );
};
