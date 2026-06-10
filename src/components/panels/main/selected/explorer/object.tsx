import { useEntitiesStore, useEntity } from "@/store/next/entities";
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
import { LEVA_THEME } from "@/constants/theming";
import { buildInputs } from "./utils";
import { ModelDowngradePanel } from "./downgrade";
import { Button } from "@/components/ui/button";
import { openAssetToybox } from "@/components/asset-toybox/controller";
import { useModelsStore } from "@/store/next/models";
import { BoxIcon } from "lucide-react";

const ObjectDetails = ({ uuid }: { uuid?: string }) => {
  const store = useStoreContext();
  const entities = useEntitiesStore((state) => state.entities);
  const transform = useTransform(uuid);
  const updateTransform = useTransformsStore((state) => state.setTransform);
  const light = useLight(uuid);
  const updateLight = useLightsStore((state) => state.setLight);
  const camera = useCamera(uuid);
  const updateCamera = useCamerasStore((state) => state.setCamera);

  const isAmbientLight =
    uuid && entities[uuid]?.type === "light" && light?.type === "ambient";

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    const entity = entities[uuid];
    if (!entity || !uuid) return {};

    i["UUID"] = {
      value: `${uuid}`,
      editable: false,
    };

    if (transform && !isAmbientLight) {
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
    if (entity.type === "model") return i;
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
    isAmbientLight,
  ]);

  // Function form + key forces Leva to remount when entity/type changes
  const [, set] = useControls(() => inputs satisfies Schema, { store }, [
    // HATE THIS
    JSON.stringify(inputs),
  ]);

  useEffect(() => {
    if (!transform || isAmbientLight) return;

    set({
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    });
  }, [transform, set, isAmbientLight]);

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

export const ObjectContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entity = useEntity(selected);
  const model = useModelsStore((state) =>
    selected ? state.models[selected] : undefined,
  );
  const isModelLoaded = model?.loadState === "loaded";
  const { setStore } = useMainPanelContext();
  const objectStore = useCreateStore();
  const authoredModelId =
    entity?.type === "model" && model?.source === "authored"
      ? model.authoredModelId
      : undefined;

  // Use unique store for each object
  // Since we need to share the store for outside components
  useEffect(() => {
    setStore(objectStore);
  }, [objectStore, setStore, selected]);

  return (
    <LevaStoreProvider key={selected} store={objectStore}>
      <div className="grid min-h-0 gap-3 pb-8">
        <section className="relative h-[260px] overflow-hidden rounded-md border bg-background">
          <ObjectDetails uuid={selected} />
        </section>
        {authoredModelId ? (
          <section className="grid gap-2 rounded-md border bg-background p-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-0 text-muted-foreground">
                Asset Toybox
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Reopen this authored object and keep editing its recipe.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAssetToybox(authoredModelId)}
            >
              <BoxIcon className="size-3.5" />
              Edit in Asset Toybox
            </Button>
          </section>
        ) : null}
        {entity?.type === "model" && isModelLoaded ? (
          <ModelDowngradePanel modelUuid={selected} embedded />
        ) : null}
      </div>
    </LevaStoreProvider>
  );
};
