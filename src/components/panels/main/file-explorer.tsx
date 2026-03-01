import * as React from "react";
import {
  UncontrolledTreeEnvironment,
  Tree,
  InteractionMode,
  type TreeDataProvider,
  type TreeItemIndex,
  type TreeItem,
} from "react-complex-tree";
import {
  SpotlightIcon,
  SunIcon,
  ConeIcon,
  SunsetIcon,
  CameraIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useEntitiesStore } from "@/store/next/entities";
import { useSetEntityChildren } from "@/hooks/next/use-set-entity-children";

const ItemTypeIconMap: Record<string, React.ReactNode> = {
  spot: <SpotlightIcon className="w-4 h-4" />,
  ambient: <SunIcon className="w-4 h-4" />,
  point: <ConeIcon className="w-4 h-4" />,
  directional: <SunsetIcon className="w-4 h-4" />,
  transform: <></>,
  camera: <CameraIcon className="w-4 h-4" />,
};

export const FileExplorer = () => {
  const entities = useEntitiesStore((state) => state.entities);
  const children = useEntitiesStore((state) => state.children);
  const setChildren = useSetEntityChildren();

  const dataProvider = React.useMemo(() => {
    const data: Record<string, TreeItem<string> & { type: string }> = {
      root: {
        index: "root",
        isFolder: true,
        children: Object.keys(entities),
        data: "Root item",
        type: "root",
      },
    };
    const hasParent = new Set<string>();

    Object.entries(entities).forEach(([uuid, entity]) => {
      const entityChildren = Object.keys(children[uuid] ?? {}).filter(
        (child) => child !== uuid,
      );

      entityChildren.forEach((child) => hasParent.add(child));

      data[uuid] = {
        index: uuid,
        isFolder: true,
        children: entityChildren,
        data: entity.name,
        type: (entity.metadata?.type as string) || entity.type,
      };
    });

    // Only keep top-level entities at root (those without a parent)
    data["root"].children = Object.keys(entities).filter(
      (uuid) => !hasParent.has(uuid),
    );

    class CustomDataProviderImplementation<T> implements TreeDataProvider {
      data = { ...data };

      treeChangeListeners: Array<(changedItemIds: TreeItemIndex[]) => void> =
        [];

      async getTreeItem(itemId: TreeItemIndex) {
        return this.data[itemId];
      }

      async onChangeItemChildren(
        itemId: TreeItemIndex,
        newChildren: TreeItemIndex[],
      ) {
        this.data[itemId].children = newChildren;
        setChildren(itemId as string, newChildren as string[]);
        console.log(itemId, newChildren);

        this.treeChangeListeners.forEach((listener) => listener([itemId]));
      }

      onDidChangeTreeData(listener: (changedItemIds: TreeItemIndex[]) => void) {
        this.treeChangeListeners.push(listener);
        return {
          dispose: () =>
            this.treeChangeListeners.splice(
              this.treeChangeListeners.indexOf(listener),
              1,
            ),
        };
      }

      async onRenameItem(item: TreeItem<T>, name: string) {
        this.data[item.index].data = name;
      }

      refresh() {
        this.treeChangeListeners.forEach((listener) => listener(["root"]));
      }
    }
    return new CustomDataProviderImplementation();
  }, [entities, children, setChildren]);

  React.useEffect(() => {
    dataProvider.refresh();
    console.log(dataProvider.data);
  }, [dataProvider, entities, children]);

  // const dataProvider = new StaticTreeDataProvider(tree, (item, newName) => ({
  //   ...item,
  //   data: newName,
  // }));
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
