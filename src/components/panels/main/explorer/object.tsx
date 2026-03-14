import * as React from "react";
import {
  UncontrolledTreeEnvironment,
  Tree,
  InteractionMode,
  type TreeDataProvider,
  type TreeItemIndex,
  type TreeItem,
} from "react-complex-tree";
import { Label } from "@/components/ui/label";
import { useEntitiesStore } from "@/store/next/entities";
import { useSetEntityChildren } from "@/hooks/next/use-set-entity-children";
import { ItemTypeIconMap } from "./constants";
import { cn } from "@/lib/utils";

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
      canDragAndDrop={false}
      canDropOnFolder={false}
      canReorderItems={false}
      onSelectItems={(item) => {
        if (item.length === 0 || item[0] === selected) {
          unselectEntity();
          return;
        }

        selectEntity(item[0] as string);
      }}
      defaultInteractionMode={InteractionMode.ClickItemToExpand}
      renderItemTitle={({ title, item, context }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const icon = ItemTypeIconMap[(item as any).type];

        return (
          <Label
            className={cn({
              "text-sm font-thin text-muted-foreground": true,
              "text-foreground": context.isSelected,
            })}
          >
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
