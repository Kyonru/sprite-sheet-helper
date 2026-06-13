import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { useLight, useLightsStore } from "@/store/next/lights";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { useMemo } from "react";
import { useCamera, useCamerasStore } from "@/store/next/cameras";
import { InspectorPanel, type InspectorField } from "@/components/inspector";
import { buildInspectorFields } from "./utils";
import { ModelDowngradePanel } from "./downgrade";
import { Button } from "@/components/ui/button";
import { openAssetToybox } from "@/components/asset-toybox/controller";
import { useModelsStore } from "@/store/next/models";
import { BoxIcon } from "lucide-react";

const ObjectDetails = ({ uuid }: { uuid?: string }) => {
  const entities = useEntitiesStore((state) => state.entities);
  const transform = useTransform(uuid);
  const updateTransform = useTransformsStore((state) => state.setTransform);
  const light = useLight(uuid);
  const updateLight = useLightsStore((state) => state.setLight);
  const camera = useCamera(uuid);
  const updateCamera = useCamerasStore((state) => state.setCamera);

  const isAmbientLight =
    uuid && entities[uuid]?.type === "light" && light?.type === "ambient";

  const fields = useMemo(() => {
    const items: InspectorField[] = [];
    if (!uuid) return items;

    const entity = entities[uuid];
    if (!entity || !uuid) return items;

    items.push({
      kind: "readonly",
      label: "UUID",
      value: uuid,
    });

    if (transform && !isAmbientLight) {
      items.push({
        kind: "vector3",
        label: "position",
        value: transform.position,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            position: value,
          });
        },
      });

      items.push({
        kind: "vector3",
        label: "rotation",
        value: transform.rotation,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            rotation: value,
          });
        },
      });

      items.push({
        kind: "vector3",
        label: "scale",
        value: transform.scale,
        onChange: (value: [number, number, number]) => {
          updateTransform(uuid, {
            scale: value,
          });
        },
      });
    }

    if (entity.type === "transform") return [];
    if (entity.type === "model") return items;
    if (entity.type === "camera") {
      if (camera) {
        items.push(...buildInspectorFields(uuid, updateCamera, camera));
      }
      return items;
    }

    if (entity.type === "light" && light) {
      if (light) {
        items.push(...buildInspectorFields(uuid, updateLight, light));
      }

      return items;
    }

    return items;
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

  return <InspectorPanel fields={fields} />;
};

export const ObjectContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entity = useEntity(selected);
  const model = useModelsStore((state) =>
    selected ? state.models[selected] : undefined,
  );
  const isModelLoaded = model?.loadState === "loaded";
  const authoredModelId =
    entity?.type === "model" && model?.source === "authored"
      ? model.authoredModelId
      : undefined;

  return (
    <div className="grid min-h-0 gap-3 pb-8">
      <section className="relative rounded-md border bg-background">
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
  );
};
