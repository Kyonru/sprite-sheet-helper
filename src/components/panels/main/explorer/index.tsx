import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMainPanelStore, type MainPanelTab } from "../store";
import { ObjectExplorer } from "./object";
import { EffectsExplorer } from "./effects";

export const FileExplorer = () => {
  const setTab = useMainPanelStore((state) => state.setTab);
  const selected = useMainPanelStore((state) => state.tab);

  return (
    <div className="flex flex-col h-full gap-2 p-2 ">
      <div className="flex flex-col overflow-y-scroll rounded-sm h-full">
        <Tabs
          value={selected}
          defaultValue="explorer"
          className="w-full h-full"
          onValueChange={(value) => setTab(value as MainPanelTab)}
        >
          <TabsList className="flex w-full">
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
            <TabsTrigger value="effects">Effects</TabsTrigger>
          </TabsList>
          <TabsContent value="explorer" className="h-full overflow-y-scroll">
            <ObjectExplorer />
          </TabsContent>
          <TabsContent value="effects" className="overflow-y-scroll">
            <EffectsExplorer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
