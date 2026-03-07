import {
  SunIcon,
  ConeIcon,
  SunsetIcon,
  CameraIcon,
  DiamondPlusIcon,
  FileAxis3DIcon,
} from "lucide-react";

export const ItemTypeIconMap: Record<string, React.ReactNode> = {
  spot: <ConeIcon className="size-4 text-yellow-600" />,
  ambient: <SunIcon className="size-4 text-yellow-600" />,
  point: <DiamondPlusIcon className="size-4 text-yellow-600" />,
  directional: <SunsetIcon className="size-4 text-yellow-600" />,
  transform: <></>,
  camera: <CameraIcon className="size-4 text-pink-900" />,
  model: <FileAxis3DIcon className="size-4 text-cyan-800" />,
};
