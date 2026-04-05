import type React from "react";
import { MenubarItem, MenubarShortcut } from "@/components/ui/menubar";
import type { ShortCutEventName } from "@/lib/events";
import { APP_SHORTCUTS } from "@/constants/shortcuts";

interface MenubarItemActionProps {
  action: () => void;
  shortcut?: ShortCutEventName;
  title: string;
}

export const MenubarItemAction = ({
  title,
  action,
  shortcut,
}: React.PropsWithChildren<MenubarItemActionProps>) => {
  const shortcutType = shortcut ? APP_SHORTCUTS[shortcut] : undefined;

  return (
    <MenubarItem onClick={action}>
      {title}
      {shortcutType && (
        <MenubarShortcut>{shortcutType.shortcut.join("")}</MenubarShortcut>
      )}
    </MenubarItem>
  );
};
