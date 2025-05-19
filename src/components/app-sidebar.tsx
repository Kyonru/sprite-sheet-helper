import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { GradientPicker } from "./ui/gradient-picker";
import { useAppColorStore } from "@/store/app-color";
import { Button } from "./ui/button";
import { EventType, PubSub } from "@/lib/events";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { useExportOptionsStore } from "@/store/export";
import type { ExportFormat } from "@/types/file";
import { AssetConfig } from "./asset-config";

export function AppSidebar() {
  const background = useAppColorStore((state) => state.color);
  const setBackground = useAppColorStore((state) => state.setColor);
  const exportFormat = useExportOptionsStore((state) => state.mode);
  const intervals = useExportOptionsStore((state) => state.intervals);
  const setIntervals = useExportOptionsStore((state) => state.setIntervals);
  const iterations = useExportOptionsStore((state) => state.iterations);
  const setIterations = useExportOptionsStore((state) => state.setIterations);
  const setExportFormat = useExportOptionsStore((state) => state.setMode);
  const takeScreenshot = () => {
    PubSub.emit(EventType.START_ASSETS_CREATION);
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sprite Helper</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="pt-1" key={"background"}>
                <div className="flex flex-row gap-2 overflow-hidden">
                  <div className="flex-1 min-w-0">
                    <GradientPicker
                      className="w-full truncate"
                      background={background}
                      setBackground={setBackground}
                    />
                  </div>
                  <div className="flex-none">
                    <ModeToggle />
                  </div>
                </div>
              </SidebarMenuItem>
              <AssetConfig />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <p className="text-md text-muted-foreground">
          Every{" "}
          <input
            type="number"
            className="w-10 border-border border-b text-md text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={intervals}
            min={1}
            onChange={(e) => setIntervals(Number(e.target.value))}
          />{" "}
          milliseconds ×{" "}
          <input
            type="number"
            className="w-10 border-border border-b text-md text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={iterations}
            min={1}
            onChange={(e) => setIterations(Number(e.target.value))}
          />{" "}
          times
        </p>
        <Tabs
          onValueChange={(format) => setExportFormat(format as ExportFormat)}
          defaultValue={exportFormat}
          value={exportFormat}
          className="mb-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zip">zip</TabsTrigger>
            <TabsTrigger value="spritesheet">spritesheet</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={takeScreenshot}>Create assets</Button>
      </SidebarFooter>
    </Sidebar>
  );
}
