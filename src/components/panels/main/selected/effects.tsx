import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BLEND_FUNCTIONS,
  EDGE_DETECTION_MODES,
  GLITCH_MODES,
  PREDICATION_MODES,
  SMAA_PRESETS,
  TONE_MAPPING_MODES,
} from "@/constants/effects";
import { useEffectsStore } from "@/store/next/effects";

import {
  button,
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
} from "leva";
import type { Schema } from "leva/plugin";
import { useMemo } from "react";
import { PALETTE_INDEX } from "../../scene/custom-effects.tsx/palette";
import { LEVA_THEME } from "@/constants/theming";
import { openShaderEditor } from "@/components/custom-shader-modal";
import type { EffectType } from "@/types/effects";

const MODE_OPTIONS_MAP: Partial<
  Record<EffectType, Record<string, number | string>>
> = {
  tonemap: TONE_MAPPING_MODES,
  glitch: GLITCH_MODES,
};

const OPTIONS_MAP: Record<string, Record<string, number | string>> = {
  blendFunction: BLEND_FUNCTIONS,
  preset: SMAA_PRESETS,
  edgeDetectionMode: EDGE_DETECTION_MODES,
  predicationMode: PREDICATION_MODES,
  palette: PALETTE_INDEX,
};

const EffectDetails = ({ uuid }: { uuid?: string }) => {
  const store = useStoreContext();
  const effects = useEffectsStore((state) => state.effects);
  const setEffect = useEffectsStore((state) => state.setEffect);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    const effect = effects[uuid];
    if (!effect || !uuid) return {};

    i["UUID"] = {
      value: `${uuid}`,
      editable: false,
    };

    for (const key in effect) {
      if (key === "type") continue;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = effect[key];

      if (
        key === "blendFunction" ||
        key === "palette" ||
        key === "edgeDetectionMode" ||
        key === "predicationMode" ||
        key === "preset"
      ) {
        const options = OPTIONS_MAP[key];
        i[key] = {
          options: options,
          value: value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      } else if (key === "scale" && effect.type === "grid") {
        i[key] = {
          min: 0,
          max: 1,
          step: 0.1,
          value: value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      } else if (key === "mode") {
        const options = MODE_OPTIONS_MAP[effect.type];

        i[key] = {
          options,
          value: value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      } else if (key === "fragmentShader") {
        i[key] = button(() => {
          openShaderEditor(uuid);
        });
      } else if (key === "brightness" || key === "contrast") {
        i[key] = {
          value: value,
          min: -1,
          max: 1,
          step: 0.01,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        };
      } else if (key === "damp") {
        i[key] = {
          value: value,
          min: 0,
          max: 0.99,
          step: 0.01,
          onChange: (newValue: unknown) => {
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

  useControls(() => inputs satisfies Schema, { store }, [uuid]);

  return (
    <LevaPanel
      theme={LEVA_THEME}
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
