import { useEntitiesStore } from "@/store/next/entities";
import { useLight, useLightsStore } from "@/store/next/lights";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
} from "leva";
import type { Schema } from "leva/plugin";
import { useEffect, useMemo } from "react";
import { useMainPanelContext } from "../../context";
import { useCamera, useCamerasStore } from "@/store/next/cameras";

const buildInputs = <T extends object>(
  uuid: string,
  updateObj: (uuid: string, props: Partial<T>) => void,
  obj: T,
  schema: Schema,
) => {
  for (const key in obj) {
    if (key === "type") continue;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    schema[key] = {
      value: obj[key],
      onChange: (value: unknown) =>
        updateObj(uuid, { [key]: value } as Partial<T>),
    };
  }
};

const ObjectDetails = ({ uuid }: { uuid?: string }) => {
  const store = useStoreContext();
  const entities = useEntitiesStore((state) => state.entities);
  const transform = useTransform(uuid);
  const updateTransform = useTransformsStore((state) => state.setTransform);
  const light = useLight(uuid);
  const updateLight = useLightsStore((state) => state.setLight);
  const camera = useCamera(uuid);
  const updateCamera = useCamerasStore((state) => state.setCamera);

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
    if (entity.type === "camera") {
      if (camera) {
        buildInputs(uuid, updateCamera, camera, i);
      }
      return i;
    }

    if (entity.type === "light" && light) {
      if (light) {
        buildInputs(uuid, updateLight, light, i);
      }

      return i;
    }

    return i;
  }, [
    entities,
    light,
    transform,
    uuid,
    updateLight,
    updateTransform,
    updateCamera,
    camera,
  ]);

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

export const ObjectContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const { setStore } = useMainPanelContext();
  const objectStore = useCreateStore();

  // Use unique store for each object
  // Since we need to share the store for outside components
  useEffect(() => {
    setStore(objectStore);
  }, [objectStore, setStore, selected]);

  return (
    <LevaStoreProvider key={selected} store={objectStore}>
      <ObjectDetails uuid={selected} />
    </LevaStoreProvider>
  );
};
