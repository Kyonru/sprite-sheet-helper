import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileExplorer } from "./file-explorer";
import { SelectedObjectTabs } from "./seleted";

const MainPanel = () => {
  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="min-h-[200px] max-w-sm "
    >
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
