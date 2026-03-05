import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BLEND_FUNCTIONS } from "@/constants/effects";
import { useEffectsStore } from "@/store/next/effects";

import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
} from "leva";
import type { Schema } from "leva/plugin";
import { useMemo } from "react";

const EffectDetails = ({ uuid }: { uuid?: string }) => {
  const store = useStoreContext();
  const effects = useEffectsStore((state) => state.effects);
  const setEffect = useEffectsStore((state) => state.setEffect);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    const effect = effects[uuid];
    if (!effect || !uuid) return {};

    for (const key in effect) {
      if (key === "type") continue;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = effect[key];

      if (key === "blendFunction") {
        i[key] = {
          options: BLEND_FUNCTIONS,
          value: value,
          onChange: (newValue: unknown) => {
            console.log(newValue);
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      } else {
        i[key] = {
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      }
    }

    return i;
  }, [effects, uuid, setEffect]);

  useControls(() => inputs satisfies Schema, { store }, [
    // HATE THIS
    JSON.stringify(inputs),
  ]);

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

const EffectContext = () => {
  const selected = useEffectsStore((state) => state.selected);
  const store1 = useCreateStore();

  return (
    <LevaStoreProvider key={selected} store={store1}>
      <EffectDetails uuid={selected} />
    </LevaStoreProvider>
  );
};

export const EffectsTabs = () => {
  const selected = useEffectsStore((state) => state.selected);
  const effects = useEffectsStore((state) => state.effects);

  const name = selected ? effects[selected]?.type : "";
  const title = name ? name.charAt(0).toUpperCase() + name.slice(1) + " " : "";

  return (
    <Tabs
      key={selected}
      defaultValue="effect"
      className="w-full h-full gap-2 p-2"
    >
      <TabsList className="flex w-full">
        <TabsTrigger value="effect">{title}Details</TabsTrigger>
      </TabsList>
      <TabsContent
        value="effect"
        className="h-full overflow-y-scroll no-scrollbar"
      >
        <EffectContext />
      </TabsContent>
    </Tabs>
  );
};
