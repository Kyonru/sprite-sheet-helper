import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileExplorer } from "./explorer/index";
import { SelectedObjectTabs } from "./selected";

const MainPanel = () => {
  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-[200px]">
      <ResizablePanel defaultSize="25%">
        <FileExplorer />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="75%">
        <SelectedObjectTabs />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default MainPanel;
