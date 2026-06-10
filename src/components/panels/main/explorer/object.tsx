/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Eye, EyeOff, Trash2Icon } from "lucide-react";
import { confirm } from "@/components/confirm";
import { useRemoveEntity } from "@/hooks/next/use-remove-entity";
import type { Entity } from "@/types/ecs";

export const ObjectExplorer = () => {
  const entities = useEntitiesStore((state) => state.entities);
  const children = useEntitiesStore((state) => state.children);
  const selected = useEntitiesStore((state) => state.selected);
  const setChildren = useSetEntityChildren();
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const unselectEntity = useEntitiesStore((state) => state.unselectEntity);
  const removeEntity = useRemoveEntity();
  const setVisibility = useEntitiesStore((state) => state.setVisibility);

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

  const onDelete = (title: string, data: TreeItem<string>) => {
    confirm.delete(title, {
      onConfirm: () => {
        removeEntity(data.index as string);
      },
    });
  };

  const onToggleVisibility = (
    event: React.MouseEvent,
    entity?: Entity,
  ) => {
    if (!entity) return;

    event.preventDefault();
    event.stopPropagation();
    setVisibility(entity.uuid, entity.visible === false);
  };

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
          <div className="w-full flex flex-row items-center justify-between group relative">
            <Label
              className={cn({
                "text-sm font-thin text-muted-foreground": true,
                "text-foreground": context.isSelected,
              })}
            >
              {icon}
              {title}
            </Label>
            <div className="flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
              {(item as any).type === "model" && (
                <button
                  type="button"
                  title={
                    entities[(item as any).index as string]?.visible === false
                      ? "Show model"
                      : "Hide model"
                  }
                  onClick={(event) =>
                    onToggleVisibility(event, entities[(item as any).index as string])
                  }
                  className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {entities[(item as any).index as string]?.visible === false ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {(item as any).type !== "camera" && (
                <Trash2Icon
                  onClick={() => onDelete(title, item)}
                  className="h-4 w-4 text-destructive cursor-pointer"
                />
              )}
            </div>
          </div>
        );
      }}
    >
      <Tree treeId="object-tree" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>
  );
};
