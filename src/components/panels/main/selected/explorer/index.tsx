import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntitiesStore } from "@/store/next/entities";
import { ObjectContext } from "./object";

export const ExplorerTabs = () => {
  const selected = useEntitiesStore((state) => state.selected);

  return (
    <Tabs
      key={selected}
      defaultValue="object"
      className="w-full h-full gap-2 p-2"
    >
      <TabsList className="flex w-full">
        <TabsTrigger value="object">Object</TabsTrigger>
        <TabsTrigger value="material">Material</TabsTrigger>
      </TabsList>
      <TabsContent
        value="object"
        className="h-full overflow-y-scroll no-scrollbar"
      >
        <ObjectContext />
      </TabsContent>
      <TabsContent value="material" className="overflow-y-scroll no-scrollbar">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Material</CardTitle>
            <CardDescription>
              Track performance and user engagement metrics. Monitor trends and
              identify growth opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm ">
            Page views are up 25% compared to last month.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
