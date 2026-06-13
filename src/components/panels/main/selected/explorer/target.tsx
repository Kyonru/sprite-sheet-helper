import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { useMemo } from "react";
import { InspectorPanel, type InspectorField } from "@/components/inspector";
import { useTargetsStore } from "@/store/next/targets";

const TargetDetails = ({ uuid }: { uuid: string }) => {
  const entity = useEntity(uuid);
  const setTarget = useTargetsStore((state) => state.setTarget);
  const target = useTargetsStore((state) => uuid && state.targets[uuid]);

  const fields = useMemo(() => {
    const items: InspectorField[] = [];
    if (!uuid) return items;

    if (!entity || !uuid || !target) return items;
    items.push({
      kind: "vector3",
      label: "position",
      value: target,
      onChange: (value: [number, number, number]) => {
        setTarget(uuid, value);
      },
    });

    return items;
  }, [entity, uuid, setTarget, target]);

  return <InspectorPanel fields={fields} />;
};

export const TargetContext = () => {
  const selected = useEntitiesStore((state) => state.selected);

  if (!selected) return null;

  return <TargetDetails uuid={selected} />;
};
