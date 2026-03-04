import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntitiesStore } from "@/store/next/entities";
import { useLight, useLightsStore } from "@/store/next/lights";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { type LightComponent } from "@/types/ecs";
import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
} from "leva";
import type { Schema } from "leva/plugin";
import { useEffect, useMemo } from "react";
import { useMainPanelStore } from "./store";

const ObjectDetails = ({ uuid }: { uuid?: string }) => {
  const store = useStoreContext();
  const entities = useEntitiesStore((state) => state.entities);
  const transform = useTransform(uuid);
  const updateTransform = useTransformsStore((state) => state.setTransform);
  const light = useLight(uuid);
  const updateLight = useLightsStore((state) => state.setLight);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    const entity = entities[uuid];
    if (!entity || !uuid) return {};

    if (transform) {
      i["position"] = {
        value: transform.position,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            position: value,
          });
        },
      };
      i["rotation"] = {
        value: transform.rotation,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            rotation: value,
          });
        },
      };
      i["scale"] = {
        value: transform.scale,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            scale: value,
          });
        },
      };
    }

    if (entity.type === "transform") return {};
    if (entity.type === "model") return {};
    if (entity.type === "camera") return {};

    if (entity.type === "light") {
      const current: LightComponent = light!;

      for (const key in current) {
        if (key === "type") continue;
        i[key] = {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          value: current[key],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange: (value: any) => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            updateLight(uuid, {
              [key]: value,
            });
          },
        };
      }
      return i;
    }

    return i;
  }, [entities, light, transform, uuid, updateLight, updateTransform]);

  // Function form + key forces Leva to remount when entity/type changes
  const [, set] = useControls(() => inputs satisfies Schema, { store }, [
    // HATE THIS
    JSON.stringify(inputs),
  ]);

  useEffect(() => {
    if (!transform) return;

    set({ position: transform.position, rotation: transform.rotation });
  }, [transform, set]);

  return (
    <LevaPanel
      hidden={false}
      neverHide
      store={store}
      fill
      flat
      titleBar={false}
    />
  );
};

const ObjectContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const store1 = useCreateStore();

  console.log(selected);
  return (
    <LevaStoreProvider key={selected} store={store1}>
      <ObjectDetails uuid={selected} />
    </LevaStoreProvider>
  );
};

const ExplorerTabs = () => {
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

const EffectsTabs = () => {
  const selected = useEntitiesStore((state) => state.selected);

  return (
    <Tabs
      key={selected}
      defaultValue="object"
      className="w-full h-full gap-2 p-2"
    >
      <TabsList className="flex w-full">
        <TabsTrigger value="effects">Effects</TabsTrigger>
      </TabsList>
      <TabsContent
        value="flex"
        className="h-full overflow-y-scroll no-scrollbar"
      >
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

export function SelectedObjectTabs() {
  const tab = useMainPanelStore((state) => state.tab);
  return tab === "explorer" ? <ExplorerTabs /> : <EffectsTabs />;
}
