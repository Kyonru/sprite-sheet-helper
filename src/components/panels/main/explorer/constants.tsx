import {
  SunIcon,
  ConeIcon,
  SunsetIcon,
  CameraIcon,
  DiamondPlusIcon,
  FileAxis3DIcon,
} from "lucide-react";

export const ItemTypeIconMap: Record<string, React.ReactNode> = {
  spot: <ConeIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
  ambient: <SunIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />,
  point: (
    <DiamondPlusIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
  ),
  directional: (
    <SunsetIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
  ),
  transform: <></>,
  camera: <CameraIcon className="size-4 shrink-0 text-pink-700 dark:text-pink-400" />,
  model: (
    <FileAxis3DIcon className="size-4 shrink-0 text-cyan-700 dark:text-cyan-400" />
  ),
};
