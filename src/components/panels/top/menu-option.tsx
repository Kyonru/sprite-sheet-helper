import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PropsWithChildren } from "react";

export const MenuOption = ({
  title,
  children,
}: PropsWithChildren<{
  title: string;
}>) => {
  return (
    <Tooltip key="bottom">
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};
