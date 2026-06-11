import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMainPanelStore, type MainPanelTab } from "../store";
import { ObjectExplorer } from "./object";
import { EffectsExplorer } from "./effects";

export const FileExplorer = () => {
  const setTab = useMainPanelStore((state) => state.setTab);
  const selected = useMainPanelStore((state) => state.tab);

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <Tabs
        value={selected}
        defaultValue="explorer"
        className="flex h-full min-h-0 flex-col gap-2"
        onValueChange={(value) => setTab(value as MainPanelTab)}
      >
        <TabsList className="flex w-full shrink-0">
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
        </TabsList>
        <TabsContent
          value="explorer"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <ObjectExplorer />
        </TabsContent>
        <TabsContent value="effects" className="min-h-0 flex-1 overflow-hidden">
          <EffectsExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
};
