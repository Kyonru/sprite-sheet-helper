import { useEntitiesStore } from "@/store/next/entities";

export const useSetEntityChildren = () => {
  const setEntityChildren = useEntitiesStore((state) => state.setChildren);

  return (uuid: string, children: string[]) => {
    setEntityChildren(uuid, children);
  };
};
