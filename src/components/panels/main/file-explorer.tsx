import * as React from "react";
import {
  UncontrolledTreeEnvironment,
  Tree,
  StaticTreeDataProvider,
  InteractionMode,
} from "react-complex-tree";
import {
  SpotlightIcon,
  SunIcon,
  ConeIcon,
  SunsetIcon,
  CameraIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";

const ItemTypeIconMap: Record<string, React.ReactNode> = {
  spotlight: <SpotlightIcon className="w-4 h-4" />,
  ambient_light: <SunIcon className="w-4 h-4" />,
  point_light: <ConeIcon className="w-4 h-4" />,
  directional_light: <SunsetIcon className="w-4 h-4" />,
  transform: <></>,
  camera: <CameraIcon className="w-4 h-4" />,
};

export const FileExplorer = () => {
  const items = {
    root: {
      index: "root",
      isFolder: true,
      children: ["child1", "child2", "child4", "child5", "child6"],
      data: "Root item",
      type: "transform",
    },
    child1: {
      index: "child1",
      isFolder: true,
      children: [],
      data: "Child item 1",
      type: "ambient_light",
    },
    child2: {
      index: "child2",
      isFolder: true,
      children: ["child3"],
      data: "Child item 2",
      type: "camera",
    },
    child3: {
      index: "child3",
      isFolder: true,
      children: [],
      data: "Child item 3",
      type: "point_light",
    },
    child4: {
      index: "child4",
      isFolder: true,
      children: [],
      data: "Child item 4",
      type: "directional_light",
    },
    child5: {
      index: "child5",
      isFolder: true,
      children: [],
      data: "Child item 5",
      type: "spotlight",
    },
    child6: {
      index: "child6",
      isFolder: true,
      children: [],
      data: "Child item 6",
      type: "transform",
    },
  };

  const dataProvider = new StaticTreeDataProvider(items, (item, newName) => ({
    ...item,
    data: newName,
  }));
  return (
    <div className="flex flex-col h-full gap-2 p-2 ">
      <div className="flex flex-col bg-accent overflow-y-scroll rounded-sm h-full">
        <UncontrolledTreeEnvironment
          dataProvider={dataProvider}
          getItemTitle={(item) => item.data}
          viewState={{}}
          canDragAndDrop={true}
          canDropOnFolder={true}
          canReorderItems={true}
          defaultInteractionMode={InteractionMode.ClickItemToExpand}
          renderItemTitle={({ title, item }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icon = ItemTypeIconMap[(item as any).type];
            return (
              <Label className="text-sm font-thin">
                {icon}
                {title}
              </Label>
            );
          }}
        >
          <Tree treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
        </UncontrolledTreeEnvironment>
      </div>
    </div>
  );
};
