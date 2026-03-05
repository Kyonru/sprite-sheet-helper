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

export const ObjectExplorer = () => {
  const entities = useEntitiesStore((state) => state.entities);
  const children = useEntitiesStore((state) => state.children);
  const selected = useEntitiesStore((state) => state.selected);
  const setChildren = useSetEntityChildren();
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const unselectEntity = useEntitiesStore((state) => state.unselectEntity);

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
        // TODO: Re-enable folder when parents are supported
        isFolder: false,
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

  return (
    <UncontrolledTreeEnvironment
      key={selected}
      dataProvider={dataProvider}
      getItemTitle={(item) => item.data}
      viewState={{
        "object-tree": {
          selectedItems: [selected ? selected : ""],
        },
      }}
      canDragAndDrop={true}
      canDropOnFolder={true}
      canReorderItems={true}
      onSelectItems={(item) => {
        if (item.length === 0) {
          unselectEntity();
          return;
        }

        console.log(item);

        selectEntity(item[0] as string);
      }}
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
      <Tree treeId="object-tree" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>
  );
};
