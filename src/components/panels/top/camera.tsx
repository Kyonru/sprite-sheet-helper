import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { EventType, PubSub } from "@/lib/events";
import { useCamerasStore } from "@/store/next/cameras";
import { useSettingsStore } from "@/store/next/settings";
import { useTarget } from "@/store/next/targets";
import { CameraIcon } from "lucide-react";
import * as THREE from "three";

export const CameraMenu = () => {
  const cameraDistance = useSettingsStore((state) => state.cameraDistance);
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const target = useTarget(cameraUUID) ?? [0, 0, 0];

  function spherical(phi: number, theta: number): [number, number, number] {
    const s = new THREE.Spherical(cameraDistance, phi, theta);
    const v = new THREE.Vector3().setFromSpherical(s);
    return [v.x + target[0], v.y + target[1], v.z + target[2]];
  }

  const deg = (d: number) => THREE.MathUtils.degToRad(d);

  const CAMERA_ANGLES: Record<
    string,
    {
      label: string;
      position: [number, number, number];
    }[]
  > = {
    topdown: [
      {
        label: "Top Down (90°)",
        position: spherical(deg(1), 0),
      },
      {
        label: "Isometric (Classic)",
        position: spherical(deg(45), deg(45)),
      },
      {
        label: "Isometric (Reverse)",
        position: spherical(deg(45), deg(225)),
      },
      {
        label: "¾ View (RPG)",
        position: spherical(deg(55), deg(0)),
      },
      {
        label: "Dimetric",
        position: spherical(deg(35), deg(90)),
      },
    ],
    sidescroller: [
      {
        label: "Side (0°)",
        position: spherical(deg(90), deg(90)),
      },
      {
        label: "Side (Slight Angle)",
        position: spherical(deg(80), deg(90)),
      },
      {
        label: "Side (Low)",
        position: spherical(deg(100), deg(90)),
      },
    ],
    shooter: [
      {
        label: "Front",
        position: spherical(deg(90), deg(0)),
      },
      {
        label: "Back",
        position: spherical(deg(90), deg(180)),
      },
      {
        label: "Over Shoulder",
        position: spherical(deg(70), deg(20)),
      },
    ],
    diagnostic: [
      {
        label: "Front",
        position: spherical(deg(90), deg(0)),
      },
      {
        label: "Back",
        position: spherical(deg(90), deg(180)),
      },
      {
        label: "Left",
        position: spherical(deg(90), deg(270)),
      },
      {
        label: "Right",
        position: spherical(deg(90), deg(90)),
      },
      { label: "Top", position: spherical(deg(1), deg(0)) },
      {
        label: "Bottom",
        position: spherical(deg(179), deg(0)),
      },
    ],
  };

  const ROTATE_STEPS = [15, 30, 45, 90];

  const emitAngle = (
    position: [number, number, number],
    target: [number, number, number],
  ) => {
    PubSub.emit(EventType.SET_CAMERA_ANGLE, { position, target });
  };

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <CameraIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent className="w-44 z-999">
        <MenubarGroup>
          <MenubarCheckboxItem checked disabled>
            Perspective
          </MenubarCheckboxItem>
          <MenubarCheckboxItem disabled>Orthographic</MenubarCheckboxItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem disabled>Perspective Settings</MenubarItem>
          <MenubarItem disabled>Orbit Settings</MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem inset disabled>
            Toggle Fullscreen
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>Fixed Angles</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarSub>
              <MenubarSubTrigger>Top Down / RPG</MenubarSubTrigger>
              <MenubarSubContent>
                {CAMERA_ANGLES.topdown.map((a) => (
                  <MenubarItem
                    key={a.label}
                    onSelect={() => emitAngle(a.position, target)}
                  >
                    {a.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>

            <MenubarSub>
              <MenubarSubTrigger>Side Scroller</MenubarSubTrigger>
              <MenubarSubContent>
                {CAMERA_ANGLES.sidescroller.map((a) => (
                  <MenubarItem
                    key={a.label}
                    onSelect={() => emitAngle(a.position, target)}
                  >
                    {a.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>

            <MenubarSub>
              <MenubarSubTrigger>Shooter</MenubarSubTrigger>
              <MenubarSubContent>
                {CAMERA_ANGLES.shooter.map((a) => (
                  <MenubarItem
                    key={a.label}
                    onSelect={() => emitAngle(a.position, target)}
                  >
                    {a.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>

            <MenubarSeparator />

            <MenubarSub>
              <MenubarSubTrigger>Diagnostic</MenubarSubTrigger>
              <MenubarSubContent>
                {CAMERA_ANGLES.diagnostic.map((a) => (
                  <MenubarItem
                    key={a.label}
                    onSelect={() => emitAngle(a.position, target)}
                  >
                    {a.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>Rotate</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarSub>
              <MenubarSubTrigger>Rotate Left</MenubarSubTrigger>
              <MenubarSubContent>
                {ROTATE_STEPS.map((deg) => (
                  <MenubarItem
                    key={deg}
                    onSelect={() =>
                      PubSub.emit(EventType.ROTATE_CAMERA, {
                        degrees: deg,
                        direction: "left",
                      })
                    }
                  >
                    {deg}°
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSub>
              <MenubarSubTrigger>Rotate Right</MenubarSubTrigger>
              <MenubarSubContent>
                {ROTATE_STEPS.map((deg) => (
                  <MenubarItem
                    key={deg}
                    onSelect={() =>
                      PubSub.emit(EventType.ROTATE_CAMERA, {
                        degrees: deg,
                        direction: "right",
                      })
                    }
                  >
                    {deg}°
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    </MenubarMenu>
  );
};
