import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";

export const useSetEntityChildren = () => {
  const setEntityChildren = useEntitiesStore((state) => state.setChildren);
  const push = useHistoryStore((state) => state.push);

  return (uuid: string, children: string[]) => {
    setEntityChildren(uuid, children);
    push({
      type: "entity/children",
      uuid,
      from: children,
      to: children,
    });
  };
};
