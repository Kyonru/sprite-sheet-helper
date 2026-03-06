import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PropsWithChildren } from "react";

export const MenuOption = ({
  title,
  children,
  className,
}: PropsWithChildren<{
  title: string;
  className?: string;
}>) => {
  return (
    <Tooltip key="bottom">
      <TooltipTrigger className={className}>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};
