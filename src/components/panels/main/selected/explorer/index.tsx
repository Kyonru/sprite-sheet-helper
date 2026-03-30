import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectContext } from "./object";
import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { capitalize } from "@/utils/strings";
import { useMemo } from "react";
import { AnimationContext } from "./animation";
import { useLight } from "@/store/next/lights";
import { TargetContext } from "./target";

const getTabs = (kind?: string, type?: string) => {
  const tabs: {
    value: string;
    label: string;
  }[] = [];

  if (kind === "model") {
    tabs.push({
      value: "animation",
      label: "Animation",
    });
    // tabs.push({
    //   value: "material",
    //   label: "Material",
    // });
  }

  if (kind === "camera") {
    tabs.push({
      value: "target",
      label: "Target",
    });
  }

  if (kind === "light" && type !== "ambient" && type !== "point") {
    tabs.push({
      value: "target",
      label: "Target",
    });
  }

  return tabs;
};

const TypeBasedTabs = ({ type }: { type: string }) => {
  console.log(" TypeBasedTabs");
  if (type === "animation") {
    return <AnimationContext />;
  }

  if (type === "target") {
    return <TargetContext />;
  }

  return null;
};

export const ExplorerTabs = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entity = useEntity(selected);
  const light = useLight(selected);

  const tabs = useMemo(
    () => getTabs(entity?.type, light?.type),
    [entity, light],
  );

  return (
    <Tabs defaultValue="object" className="w-full h-full gap-2 p-2">
      <TabsList className="flex w-full">
        <TabsTrigger value="object">
          {capitalize(entity?.type || "", true) || "Object"}
        </TabsTrigger>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
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
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="h-full overflow-y-scroll no-scrollbar"
        >
          <TypeBasedTabs key={tab.value} type={tab.value} />
        </TabsContent>
      ))}
    </Tabs>
  );
};
