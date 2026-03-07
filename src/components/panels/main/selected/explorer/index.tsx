import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectContext } from "./object";
import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { capitalize } from "@/utils/strings";
import { useMemo } from "react";

const getTabs = (kind?: string) => {
  const tabs: {
    value: string;
    label: string;
  }[] = [];

  if (kind === "model") {
    tabs.push({
      value: "animation",
      label: "Animation",
    });
    tabs.push({
      value: "material",
      label: "Material",
    });
  }

  if (kind === "camera") {
    tabs.push({
      value: "target",
      label: "Target",
    });
  }

  if (kind === "light") {
    tabs.push({
      value: "target",
      label: "Target",
    });
  }

  return tabs;
};

export const ExplorerTabs = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entity = useEntity(selected);

  const tabs = useMemo(() => getTabs(entity?.type), [entity]);

  return (
    <Tabs defaultValue="object" className="w-full h-full gap-2 p-2">
      <TabsList className="flex w-full">
        <TabsTrigger value="object">
          {capitalize(entity?.type || "", true) || "Object"}
        </TabsTrigger>
        {tabs.map((tab) => (
          <TabsTrigger value={tab.value}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        key={selected}
        value="object"
        className="h-full overflow-y-scroll no-scrollbar"
      >
        <ObjectContext />
      </TabsContent>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{tab.label}</CardTitle>
              <CardDescription>
                Track performance and user engagement metrics. Monitor trends
                and identify growth opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm ">
              Page views are up 25% compared to last month.
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};
