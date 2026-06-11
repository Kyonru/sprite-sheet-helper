import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectContext } from "./object";
import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { capitalize } from "@/utils/strings";
import { useMemo } from "react";
import { AnimationContext } from "./animation";
import { useLight } from "@/store/next/lights";
import { TargetContext } from "./target";
import { MaterialContext } from "./material";
import { ItemTypeIconMap } from "../../explorer/constants";
import { BoxIcon, MousePointerClick } from "lucide-react";

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

  if (kind === "light" && type !== "ambient" && type !== "point") {
    tabs.push({
      value: "target",
      label: "Target",
    });
  }

  return tabs;
};

const TypeBasedTabs = ({ type }: { type: string }) => {
  if (type === "animation") {
    return <AnimationContext />;
  }

  if (type === "target") {
    return <TargetContext />;
  }

  if (type === "material") {
    return <MaterialContext />;
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

  if (!selected || !entity) {
    return (
      <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
        <div>
          <MousePointerClick className="mx-auto mb-2 size-5" />
          Select an object in the explorer to inspect it.
        </div>
      </div>
    );
  }

  const iconType = (entity.metadata?.type as string) || entity.type;
  const typeLabel = light
    ? `${capitalize(entity.type, true)} · ${capitalize(light.type, true)}`
    : capitalize(entity.type, true);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <section className="shrink-0 rounded-md border bg-background p-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md border bg-muted/30 p-1.5">
            {ItemTypeIconMap[iconType] ?? <BoxIcon className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{entity.name}</div>
            <p className="truncate text-xs text-muted-foreground">
              {typeLabel}
            </p>
          </div>
        </div>
      </section>
      <Tabs
        key={selected}
        defaultValue="object"
        className="flex min-h-0 w-full flex-1 flex-col gap-2"
      >
        <TabsList className="flex w-full shrink-0">
          <TabsTrigger value="object">Object</TabsTrigger>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value="object"
          className="min-h-0 flex-1 overflow-y-auto no-scrollbar"
        >
          <ObjectContext />
        </TabsContent>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="min-h-0 flex-1 overflow-y-auto no-scrollbar"
          >
            <TypeBasedTabs key={tab.value} type={tab.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
