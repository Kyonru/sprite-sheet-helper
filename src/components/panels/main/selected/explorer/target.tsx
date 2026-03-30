import { useEntitiesStore, useEntity } from "@/store/next/entities";
import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
} from "leva";
import type { Schema } from "leva/plugin";
import { useMemo } from "react";
import { LEVA_THEME } from "@/constants/theming";
import { useTargetsStore } from "@/store/next/targets";

const TargetDetails = ({ uuid }: { uuid: string }) => {
  const store = useStoreContext();
  const entity = useEntity(uuid);
  // const targets = useTargetsStore((state) => state.targets);
  // const target = useTargetsStore((state) => uuid && state.targets[uuid]);
  const setTarget = useTargetsStore((state) => state.setTarget);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    // const target = targets[uuid];
    const target = useTargetsStore.getState().targets[uuid];

    if (!entity || !uuid || !target) return i;
    i["position"] = {
      value: target,
      onChange: (value: [number, number, number]) => {
        console.log(value);
        setTarget(uuid, value);
      },
    };

    return i;
  }, [entity, uuid, setTarget]);

  // Function form + key forces Leva to remount when entity/type changes
  useControls(() => inputs satisfies Schema, { store }, [
    // HATE THIS
    JSON.stringify(inputs),
  ]);

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

export const TargetContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const targetStore = useCreateStore();

  if (!selected) return null;

  return (
    <LevaStoreProvider key={selected} store={targetStore}>
      <TargetDetails uuid={selected} />
    </LevaStoreProvider>
  );
};
