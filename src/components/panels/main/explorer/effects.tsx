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
import { useEffectsStore } from "@/store/next/effects";
import { cn } from "@/lib/utils";

export const EffectsExplorer = () => {
  const effects = useEffectsStore((state) => state.effects);
  const setSelected = useEffectsStore((state) => state.setSelected);
  const selected = useEffectsStore((state) => state.selected);

  const dataProvider = React.useMemo(() => {
    const data: Record<string, TreeItem<string>> = {
      root: {
        index: "root",
        isFolder: false,
        children: Object.keys(effects),
        data: "Effects",
      },
    };

    Object.entries(effects).forEach(([uuid, effect]) => {
      data[uuid] = {
        index: uuid,
        isFolder: false,
        children: [],
        data: effect.type,
      };
    });

    class EffectsDataProvider implements TreeDataProvider {
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

      async onRenameItem(item: TreeItem<string>, name: string) {
        this.data[item.index].data = name;
      }

      refresh() {
        this.treeChangeListeners.forEach((listener) => listener(["root"]));
      }
    }

    return new EffectsDataProvider();
  }, [effects]);

  React.useEffect(() => {
    dataProvider.refresh();
  }, [dataProvider, effects]);

  return (
    <UncontrolledTreeEnvironment
      key={selected}
      dataProvider={dataProvider}
      getItemTitle={(item) => item.data}
      viewState={{
        "effects-tree": {
          selectedItems: [selected ? selected : ""],
        },
      }}
      canDragAndDrop={false}
      canDropOnFolder={false}
      canReorderItems={true}
      onSelectItems={(items) => {
        setSelected(items.length > 0 ? (items[0] as string) : undefined);
      }}
      defaultInteractionMode={InteractionMode.ClickItemToExpand}
      renderItemTitle={({ title, context }) => (
        <Label
          className={cn({
            "text-sm font-thin capitalize text-muted-foreground": true,
            "text-foreground": context.isSelected,
          })}
        >
          {title}
        </Label>
      )}
    >
      <Tree treeId="effects-tree" rootItem="root" treeLabel="Effects" />
    </UncontrolledTreeEnvironment>
  );
};
