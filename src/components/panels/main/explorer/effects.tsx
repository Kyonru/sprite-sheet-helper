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
import { Trash2Icon } from "lucide-react";
import { confirm } from "@/components/confirm";

export const EffectsExplorer = () => {
  const effects = useEffectsStore((state) => state.effects);
  const setSelected = useEffectsStore((state) => state.setSelected);
  const removeEffect = useEffectsStore((state) => state.removeEffect);
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

  const onDelete = (title: string, data: TreeItem<string>) => {
    confirm.delete(title, {
      onConfirm: () => {
        removeEffect(data.index as string);
      },
    });
  };

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
      renderItemTitle={({ title, context, item }) => (
        <div className="w-full flex flex-row items-center justify-between group relative">
          <Label
            className={cn({
              "text-sm font-thin capitalize text-muted-foreground": true,
              "text-foreground": context.isSelected,
            })}
          >
            {title}
          </Label>
          <Trash2Icon
            onClick={() => onDelete(title, item)}
            className="h-4 w-4 opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2 text-destructive cursor-pointer"
          />
        </div>
      )}
    >
      <Tree treeId="effects-tree" rootItem="root" treeLabel="Effects" />
    </UncontrolledTreeEnvironment>
  );
};
