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
import { AssetConfig } from "./config/asset-config";
import { Leva } from "leva";
import { Input } from "./ui/input";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import { useModelStore } from "@/store/model";
import { useEffect, useState } from "react";
import { LucideLoaderCircle } from "lucide-react";

const levaTheme = {
  colors: {
    elevation1: "var(--background)",
    elevation2: "var(--muted)",
    elevation3: "var(--border)",

    accent1: "var(--primary)",
    accent2: "var(--accent-foreground)",
    accent3: "var(--ring)",

    highlight1: "var(--primary-foreground)",
    highlight2: "var(--muted-foreground)",
    highlight3: "var(--chart-3)",

    vivid1: "var(--destructive)",
  },
  radii: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "var(--radius)",
  },
  space: {
    rowGap: "0.5rem",
    colGap: "0.5rem",
    controlHeight: "2rem",
  },
  fontSizes: {
    root: "14px",
    label: "12px",
    toolTip: "11px",
  },
};

export function AppSidebar() {
  const background = useAppColorStore((state) => state.color);
  const setBackground = useAppColorStore((state) => state.setColor);
  const setModelFile = useModelStore((state) => state.setFile);
  const [exporting, setExporting] = useState(false);
  const takeScreenshot = () => {
    setExporting(true);
    PubSub.emit(EventType.START_ASSETS_CREATION);
  };

  useEffect(() => {
    const stopExporting = () => {
      setExporting(false);
    };

    PubSub.on(EventType.STOP_ASSETS_CREATION, stopExporting);
    return () => {
      PubSub.off(EventType.STOP_ASSETS_CREATION, stopExporting);
    };
  }, []);

  return (
    <Sidebar>
      <SidebarContent className="no-scrollbar">
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
              <Input
                id="model"
                type="file"
                accept={`.${ACCEPTED_MODEL_FILE_TYPES.join(",.")}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setModelFile(file);
                }}
              />
              <Leva
                titleBar={false}
                // theme={myTheme} // you can pass a custom theme (see the styling section)
                fill // default = false,  true makes the pane fill the parent dom node it's rendered in
                flat // default = false,  true removes border radius and shadow
                // oneLineLabels // default = false, alternative layout for labels, with labels and fields on separate rows
                // hideTitleBar={true} // default = false, hides the GUI header
                // collapsed // default = false, when true the GUI is collpased
                // hidden // default = false, when true the GUI is hidden
                theme={levaTheme}
              />
              <AssetConfig />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <Button disabled={exporting} onClick={takeScreenshot}>
          {exporting ? (
            <LucideLoaderCircle className="animate-spin" />
          ) : (
            "Create assets"
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
