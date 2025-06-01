import { useMemo, useState } from "react";
import {
  LucideEyeOff,
  LucideMove3D,
  LucideTimer,
  LucideTrash,
} from "lucide-react";
import { button, folder, useControls } from "leva";
import type { AnimationObject, Easing, Track, TrackProperty } from "./types";
import { useTimelineContext } from "./hooks/useTimeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import type { StoreType } from "leva/dist/declarations/src/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface KeyframeOptions {
  property: TrackProperty;
  fromValue: number;
  toValue: number;
  startAt: number;
  endAt: number;
  easing: Easing;
}

const AddKeyframeMenu = ({
  onAdd,
  onCancel,
  store,
  track,
}: {
  onAdd: (options: KeyframeOptions) => void;
  onCancel: () => void;
  store?: StoreType;
  track: Track;
}) => {
  const properties = useMemo(() => {
    return {
      [track.property]: folder({
        fromValue: 0,
        toValue: 0,
        startAt: 0,
        endAt: 0,
        easing: {
          options: ["linear", "easeInOut", "easeOut"] as Easing[],
          value: "linear",
        },
        done: button((get) => {
          const fromValue = get(`${track.property}.fromValue`);
          const toValue = get(`${track.property}.toValue`);
          const startAt = get(`${track.property}.startAt`);
          const endAt = get(`${track.property}.endAt`);
          const easing = get(`${track.property}.easing`);
          onAdd({
            property: track.property,
            fromValue,
            toValue,
            startAt,
            endAt,
            easing,
          });
        }),
        cancel: button(() => {
          onCancel();
        }),
      }),
    };
  }, [track, onAdd, onCancel]);

  useControls(properties, { store: store }, [track.property]);

  return null;
};

const ObjectProperty = ({
  object,
  track,
}: {
  object: AnimationObject;
  track: Track;
}) => {
  const { keyframeStore, addKeyframe, removeProperty } = useTimelineContext();
  const [isAddingKeyframe, setIsAddingKeyframe] = useState(false);

  const onAddKeyframe = (options: KeyframeOptions) => {
    setIsAddingKeyframe(false);
    addKeyframe(object.id, options.property, {
      fromValue: options.fromValue,
      toValue: options.toValue,
      start: options.startAt,
      end: options.endAt,
      easing: options.easing,
    });
  };

  const onCancel = () => {
    setIsAddingKeyframe(false);
  };

  const onRemove = () => {
    removeProperty(object.id, track.property);
  };

  return (
    <>
      {isAddingKeyframe && (
        <AddKeyframeMenu
          store={keyframeStore}
          track={track}
          onAdd={onAddKeyframe}
          onCancel={onCancel}
        />
      )}
      <AlertDialog>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div
              key={track.id}
              className="px-3 py-1 text-xs border-b text-muted-foreground h-6 flex items-center"
            >
              {track.property}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="z-400">
            <DropdownMenuItem
              className="text-blue-500"
              onClick={() => setIsAddingKeyframe(true)}
            >
              <LucideTimer className="text-blue-500" /> Add keyframe
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => console.log("Disable object", object.id)}
            >
              <LucideEyeOff /> Disable
            </DropdownMenuItem>
            <AlertDialogTrigger className="w-full">
              <DropdownMenuItem className="text-red-500">
                <LucideTrash className="text-red-500" />
                Remove
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue with removing?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={onRemove}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const AddPropertyMenu = ({
  onAdd,
  onCancel,
  store,
}: {
  obj: AnimationObject;
  onAdd: (property: TrackProperty) => void;
  onCancel: () => void;
  store?: StoreType;
}) => {
  useControls(
    {
      property: {
        options: ["x", "y", "z", "opacity"] as TrackProperty[],
        value: "x",
      },
      done: button((get) => {
        onAdd(get("property"));
      }),
      cancel: button(() => {
        onCancel();
      }),
    },
    { store: store }
  );

  return null;
};

export const ObjectProperties = ({ obj }: { obj: AnimationObject }) => {
  const { removeObject, addProperty, propertyStore } = useTimelineContext();
  const [isAddingProperty, setIsAddingProperty] = useState(false);

  const onAddProperty = (property: TrackProperty) => {
    addProperty(obj.id, property);
    setIsAddingProperty(false);
  };
  const onCancel = () => {
    setIsAddingProperty(false);
  };
  const onRemove = () => {
    removeObject(obj.id);
  };
  const onAnimate = () => {
    setIsAddingProperty(true);
  };
  const onDisable = () => {
    console.log("Disable object", obj.id);
  };

  return (
    <div className="w-[150px] sticky left-0 z-100 bg-muted border-b border-r">
      {isAddingProperty && (
        <AddPropertyMenu
          store={propertyStore}
          obj={obj}
          onAdd={onAddProperty}
          onCancel={onCancel}
        />
      )}
      <AlertDialog>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div
              onAuxClick={(e) => e.stopPropagation()}
              className="px-2 py-1 font-medium text-sm bg-popover text-popover-foreground border-b h-[32px]"
            >
              {obj.name}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="z-400">
            <DropdownMenuItem className="text-blue-500" onClick={onAnimate}>
              <LucideMove3D className="text-blue-500" /> Animate Property
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDisable}>
              <LucideEyeOff /> Disable
            </DropdownMenuItem>
            <AlertDialogTrigger className="w-full">
              <DropdownMenuItem className="text-red-500">
                <LucideTrash className="text-red-500" />
                Remove
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Continue with removing?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={onRemove}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {obj.tracks.map((track) => (
        <ObjectProperty key={track.id} object={obj} track={track} />
      ))}
    </div>
  );
};
