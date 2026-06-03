import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthoredModelsStore } from "@/store/next/authored-models";
import type {
  AuthoredBone,
  AuthoredExtrudeFace,
  AuthoredModelRecipe,
  AuthoredPart,
  AuthoredPrimitiveKind,
  AuthoredVector3,
} from "@/types/authored-models";
import {
  AUTHORED_WORLD_BONE_ID,
  buildAuthoredModelObject,
  exportAuthoredModelGlb,
} from "@/utils/authored-models";
import { downloadFile } from "@/utils/assets";
import {
  getAssetToyboxState,
  setAssetToyboxState,
  subscribeAssetToybox,
} from "./controller";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import {
  BoxIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontalIcon,
  HammerIcon,
  Move3DIcon,
  PlusIcon,
  Rotate3DIcon,
  RotateCcwIcon,
  Scale3DIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import * as THREE from "three";

const PRIMITIVES: { value: AuthoredPrimitiveKind; label: string }[] = [
  { value: "box", label: "Box" },
  { value: "cube", label: "Cube" },
  { value: "capsule", label: "Capsule" },
  { value: "circle", label: "Circle" },
  { value: "cone", label: "Cone" },
  { value: "cylinder", label: "Cylinder" },
  { value: "dodecahedron", label: "Dodecahedron" },
  { value: "edges", label: "Edges" },
  { value: "extrude", label: "Extrude" },
  { value: "icosahedron", label: "Icosahedron" },
  { value: "lathe", label: "Lathe" },
  { value: "octahedron", label: "Octahedron" },
  { value: "plane", label: "Plane" },
  { value: "polyhedron", label: "Polyhedron" },
  { value: "ring", label: "Ring" },
  { value: "shape", label: "Shape" },
  { value: "sphere", label: "Sphere" },
  { value: "tetrahedron", label: "Tetrahedron" },
  { value: "torus", label: "Torus" },
  { value: "torusKnot", label: "Torus Knot" },
  { value: "tube", label: "Tube" },
  { value: "wireframe", label: "Wireframe" },
];

const KITBASH_PARTS: {
  name: string;
  primitive: AuthoredPrimitiveKind;
  scale: AuthoredVector3;
}[] = [
  { name: "Head", primitive: "sphere", scale: [0.34, 0.4, 0.34] },
  { name: "Torso", primitive: "box", scale: [0.64, 0.78, 0.34] },
  { name: "Limb", primitive: "capsule", scale: [0.2, 0.5, 0.2] },
  { name: "Weapon", primitive: "box", scale: [0.08, 0.58, 0.08] },
  { name: "Shield", primitive: "cylinder", scale: [0.42, 0.12, 0.42] },
  { name: "Crate", primitive: "box", scale: [0.5, 0.5, 0.5] },
  { name: "Tree", primitive: "cone", scale: [0.55, 0.9, 0.55] },
  { name: "Rock", primitive: "sphere", scale: [0.5, 0.34, 0.42] },
];

const EXTRUDE_FACES: { value: AuthoredExtrudeFace; label: string }[] = [
  { value: "px", label: "+X" },
  { value: "nx", label: "-X" },
  { value: "py", label: "+Y" },
  { value: "ny", label: "-Y" },
  { value: "pz", label: "+Z" },
  { value: "nz", label: "-Z" },
];

type ToyboxTransformMode = "translate" | "scale" | "rotate" | "extrude";

const TRANSFORM_TOOLS: {
  value: ToyboxTransformMode;
  label: string;
  icon: ReactNode;
}[] = [
  {
    value: "translate",
    label: "Move",
    icon: <Move3DIcon className="size-4" />,
  },
  { value: "scale", label: "Scale", icon: <Scale3DIcon className="size-4" /> },
  {
    value: "rotate",
    label: "Rotate",
    icon: <Rotate3DIcon className="size-4" />,
  },
  {
    value: "extrude",
    label: "Extrude",
    icon: <HammerIcon className="size-4" />,
  },
];

export function AssetToyboxProvider() {
  const [state, setState] = useState(getAssetToyboxState());

  useEffect(() => {
    return subscribeAssetToybox(setState);
  }, []);

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        setAssetToyboxState({
          open,
          recipeId: open ? state.recipeId : undefined,
        })
      }
    >
      <DialogContent className="flex h-[96vh] max-h-[980px] w-[98vw] max-w-[calc(100vw-1rem)] sm:max-w-[1800px] grid-rows-[auto_1fr] flex-col gap-3 overflow-hidden p-3 z-999">
        <DialogHeader className="shrink-0">
          <DialogTitle>Asset Toybox</DialogTitle>
        </DialogHeader>
        <AssetToyboxPanel recipeId={state.recipeId} />
      </DialogContent>
    </Dialog>
  );
}

function AssetToyboxPanel({ recipeId }: { recipeId?: string }) {
  const selectedRecipeId = useAuthoredModelsStore(
    (state) => state.selectedRecipeId,
  );
  const activeRecipeId = recipeId ?? selectedRecipeId;
  const recipe = useAuthoredModelsStore((state) =>
    activeRecipeId ? state.recipes[activeRecipeId] : undefined,
  );

  if (!recipe || !activeRecipeId) {
    return (
      <div className="grid flex-1 place-items-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
        Create a skeleton character to start modeling.
      </div>
    );
  }

  return <AssetToyboxEditor recipe={recipe} />;
}

function AssetToyboxEditor({ recipe }: { recipe: AuthoredModelRecipe }) {
  const updateRecipe = useAuthoredModelsStore((state) => state.updateRecipe);
  const updateBone = useAuthoredModelsStore((state) => state.updateBone);
  const addPart = useAuthoredModelsStore((state) => state.addPart);
  const updatePart = useAuthoredModelsStore((state) => state.updatePart);
  const duplicatePart = useAuthoredModelsStore((state) => state.duplicatePart);
  const removePart = useAuthoredModelsStore((state) => state.removePart);
  const selectBone = useAuthoredModelsStore((state) => state.selectBone);
  const selectPart = useAuthoredModelsStore((state) => state.selectPart);
  const mirrorSelection = useAuthoredModelsStore(
    (state) => state.mirrorSelection,
  );
  const extrudePart = useAuthoredModelsStore((state) => state.extrudePart);
  const updateExtrusion = useAuthoredModelsStore(
    (state) => state.updateExtrusion,
  );
  const updateSwatch = useAuthoredModelsStore((state) => state.updateSwatch);
  const resetPose = useAuthoredModelsStore((state) => state.resetPose);
  const [transformMode, setTransformMode] =
    useState<ToyboxTransformMode>("translate");
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [extrudeFace, setExtrudeFace] = useState<AuthoredExtrudeFace>("pz");
  const [extrudeDistance, setExtrudeDistance] = useState(0.2);
  const [extrudeScale, setExtrudeScale] = useState<[number, number]>([
    0.8, 0.8,
  ]);
  const [exporting, setExporting] = useState(false);

  const selectedBone =
    recipe.bones[recipe.selectedBoneId ?? ""] ??
    recipe.bones[recipe.boneOrder[0]];
  const selectedPart =
    recipe.parts[recipe.selectedPartId ?? ""] ??
    recipe.parts[recipe.partOrder[0]];
  const firstSwatch = recipe.swatches[recipe.swatchOrder[0]];

  const addPrimitive = (
    primitive: AuthoredPrimitiveKind,
    name = primitiveLabel(primitive),
    scale?: AuthoredVector3,
  ) => {
    addPart(recipe.uuid, {
      name,
      boneId: selectedBone?.uuid ?? AUTHORED_WORLD_BONE_ID,
      primitive,
      scale,
      swatchId: firstSwatch?.uuid,
      color: firstSwatch?.color,
    });
  };

  const runExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const buffer = await exportAuthoredModelGlb(recipe);
      downloadFile(
        new Blob([buffer], { type: "model/gltf-binary" }),
        `${recipe.name.replace(/\s+/g, "_")}.glb`,
      );
    } catch (error) {
      toast.error("Authored GLB export failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,0.7fr)_minmax(560px,2.4fr)_minmax(340px,0.95fr)] gap-3 overflow-hidden max-xl:grid-cols-[220px_minmax(460px,1fr)] max-xl:grid-rows-[minmax(520px,1fr)_minmax(320px,0.65fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-background max-xl:row-span-2">
        <div className="border-b px-3 py-2">
          <Input
            value={recipe.name}
            onChange={(event) =>
              updateRecipe(recipe.uuid, { name: event.target.value })
            }
            className="h-8"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Bones
          </div>
          {recipe.boneOrder.length === 0 ? (
            <button
              className="flex min-w-0 items-center rounded-md bg-muted px-2 py-1.5 text-left text-xs"
              onClick={() => selectBone(recipe.uuid, undefined)}
            >
              <span className="truncate">World root</span>
            </button>
          ) : (
            <div className="grid gap-1">
              {recipe.boneOrder.map((boneId) => {
                const bone = recipe.bones[boneId];
                if (!bone) return null;
                const depth = boneDepth(recipe, bone);
                const active = bone.uuid === selectedBone?.uuid;
                return (
                  <button
                    key={bone.uuid}
                    className={`flex min-w-0 items-center rounded-md px-2 py-1.5 text-left text-xs ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    style={{ paddingLeft: 8 + depth * 12 }}
                    onClick={() => selectBone(recipe.uuid, bone.uuid)}
                  >
                    <span className="truncate">{bone.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
            Parts
          </div>
          <div className="grid gap-1">
            {recipe.partOrder.map((partId) => {
              const part = recipe.parts[partId];
              if (!part) return null;
              const active = part.uuid === selectedPart?.uuid;
              return (
                <button
                  key={part.uuid}
                  className={`flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => selectPart(recipe.uuid, part.uuid)}
                >
                  <span className="truncate">{part.name}</span>
                  <span className="shrink-0 opacity-70">{part.primitive}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative min-h-0 overflow-hidden rounded-md border bg-[#202125]">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm backdrop-blur">
          {TRANSFORM_TOOLS.map((tool) => (
            <Button
              key={tool.value}
              size="icon"
              variant={transformMode === tool.value ? "default" : "ghost"}
              className="size-8"
              title={tool.label}
              onClick={() => setTransformMode(tool.value)}
            >
              {tool.icon}
            </Button>
          ))}
        </div>
        {recipe.boneOrder.length > 0 ? (
          <Button
            size="icon"
            variant={showSkeleton ? "default" : "ghost"}
            className="absolute right-3 top-3 z-10 size-8 border bg-background/90 shadow-sm backdrop-blur"
            title={showSkeleton ? "Hide skeleton" : "Show skeleton"}
            onClick={() => setShowSkeleton((value) => !value)}
          >
            {showSkeleton ? (
              <EyeIcon className="size-4" />
            ) : (
              <EyeOffIcon className="size-4" />
            )}
          </Button>
        ) : null}
        <ToyboxViewport
          recipe={recipe}
          selectedPartId={selectedPart?.uuid}
          selectedBoneId={selectedBone?.uuid}
          transformMode={transformMode}
          showSkeleton={showSkeleton}
          onPartTransformChange={(partId, props) =>
            updatePart(recipe.uuid, partId, props)
          }
          onVisualExtrude={(face) =>
            selectedPart
              ? extrudePart(
                  recipe.uuid,
                  selectedPart.uuid,
                  face,
                  0.01,
                  extrudeScale,
                )
              : undefined
          }
          onVisualExtrudeChange={(extrusionId, distance) => {
            if (!selectedPart) return;
            setExtrudeDistance(distance);
            updateExtrusion(recipe.uuid, selectedPart.uuid, extrusionId, {
              distance,
              scale: extrudeScale,
            });
          }}
        />
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-background max-xl:col-start-2">
        <Tabs defaultValue="parts" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="m-2 grid grid-cols-4">
            <TabsTrigger value="parts">Parts</TabsTrigger>
            <TabsTrigger value="pose">Pose</TabsTrigger>
            <TabsTrigger value="swatches">Swatches</TabsTrigger>
            <TabsTrigger value="export">Save</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <TabsContent value="parts" className="mt-0 grid gap-3">
              <PanelBlock title="Primitive Builder">
                <div className="rounded-md border bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
                  New parts attach to{" "}
                  <span className="font-medium text-foreground">
                    {selectedBone?.name ?? "World root"}
                  </span>
                  .
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRIMITIVES.map((primitive) => (
                    <Button
                      key={primitive.value}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        addPrimitive(primitive.value, primitive.label)
                      }
                    >
                      <PlusIcon className="size-3.5" />
                      {primitive.label}
                    </Button>
                  ))}
                </div>
              </PanelBlock>

              <PanelBlock title="Kitbash">
                <div className="grid grid-cols-2 gap-2">
                  {KITBASH_PARTS.map((part) => (
                    <Button
                      key={part.name}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        addPrimitive(part.primitive, part.name, part.scale)
                      }
                    >
                      <BoxIcon className="size-3.5" />
                      {part.name}
                    </Button>
                  ))}
                </div>
              </PanelBlock>

              {selectedPart ? (
                <PartInspector
                  recipe={recipe}
                  part={selectedPart}
                  onChange={(props) =>
                    updatePart(recipe.uuid, selectedPart.uuid, props)
                  }
                  onDuplicate={() =>
                    duplicatePart(recipe.uuid, selectedPart.uuid)
                  }
                  onDelete={() => removePart(recipe.uuid, selectedPart.uuid)}
                  onMirror={() =>
                    mirrorSelection(recipe.uuid, "part", selectedPart.uuid)
                  }
                  extrudeFace={extrudeFace}
                  extrudeDistance={extrudeDistance}
                  extrudeScale={extrudeScale}
                  onExtrudeFaceChange={setExtrudeFace}
                  onExtrudeDistanceChange={setExtrudeDistance}
                  onExtrudeScaleChange={setExtrudeScale}
                  onExtrude={() =>
                    extrudePart(
                      recipe.uuid,
                      selectedPart.uuid,
                      extrudeFace,
                      extrudeDistance,
                      extrudeScale,
                    )
                  }
                />
              ) : null}
              {!selectedPart ? (
                <PanelBlock title="No part selected">
                  <div className="text-xs text-muted-foreground">
                    Choose a primitive or kitbash part to start shaping this
                    asset.
                  </div>
                </PanelBlock>
              ) : null}
            </TabsContent>

            <TabsContent value="pose" className="mt-0 grid gap-3">
              {selectedBone ? (
                <PanelBlock title={selectedBone.name}>
                  <VectorEditor
                    label="Position"
                    value={selectedBone.position}
                    step={0.01}
                    onChange={(position) =>
                      updateBone(recipe.uuid, selectedBone.uuid, { position })
                    }
                  />
                  <VectorEditor
                    label="Rotation"
                    value={selectedBone.rotation}
                    step={0.05}
                    onChange={(rotation) =>
                      updateBone(recipe.uuid, selectedBone.uuid, { rotation })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        mirrorSelection(recipe.uuid, "bone", selectedBone.uuid)
                      }
                    >
                      <FlipHorizontalIcon className="size-3.5" />
                      Mirror
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPose(recipe.uuid)}
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Reset pose
                    </Button>
                  </div>
                </PanelBlock>
              ) : (
                <PanelBlock title="Primitive asset">
                  <div className="text-xs text-muted-foreground">
                    This asset has no skeleton. Use Parts and viewport tools to
                    move, scale, rotate, and extrude geometry from World root.
                  </div>
                </PanelBlock>
              )}
            </TabsContent>

            <TabsContent value="swatches" className="mt-0 grid gap-3">
              {recipe.swatchOrder.map((swatchId) => {
                const swatch = recipe.swatches[swatchId];
                if (!swatch) return null;
                return (
                  <PanelBlock key={swatch.uuid} title={swatch.name}>
                    <div className="grid grid-cols-[44px_1fr] gap-2">
                      <Input
                        type="color"
                        value={swatch.color}
                        onChange={(event) =>
                          updateSwatch(recipe.uuid, swatch.uuid, {
                            color: event.target.value,
                          })
                        }
                        className="h-9 p-1"
                      />
                      <Input
                        value={swatch.name}
                        onChange={(event) =>
                          updateSwatch(recipe.uuid, swatch.uuid, {
                            name: event.target.value,
                          })
                        }
                      />
                    </div>
                  </PanelBlock>
                );
              })}
            </TabsContent>

            <TabsContent value="export" className="mt-0 grid gap-3">
              <PanelBlock title="Authored model">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Metric label="Bones" value={recipe.boneOrder.length} />
                  <Metric label="Parts" value={recipe.partOrder.length} />
                  <Metric label="Swatches" value={recipe.swatchOrder.length} />
                  <Metric
                    label="Extrusions"
                    value={Object.values(recipe.parts).reduce(
                      (sum, part) => sum + part.extrusions.length,
                      0,
                    )}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={exporting}
                  onClick={runExport}
                  className="mt-3 w-full"
                >
                  <DownloadIcon className="size-3.5" />
                  Export GLB
                </Button>
              </PanelBlock>
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  );
}

function ToyboxViewport({
  recipe,
  selectedPartId,
  selectedBoneId,
  transformMode,
  showSkeleton,
  onPartTransformChange,
  onVisualExtrude,
  onVisualExtrudeChange,
}: {
  recipe: AuthoredModelRecipe;
  selectedPartId?: string;
  selectedBoneId?: string;
  transformMode: ToyboxTransformMode;
  showSkeleton: boolean;
  onPartTransformChange: (partId: string, props: Partial<AuthoredPart>) => void;
  onVisualExtrude: (face: AuthoredExtrudeFace) => string | undefined;
  onVisualExtrudeChange: (extrusionId: string, distance: number) => void;
}) {
  const [draggingExtrude, setDraggingExtrude] = useState(false);
  const built = useMemo(
    () =>
      buildAuthoredModelObject(recipe, {
        includeSkeleton: showSkeleton,
        selectedBoneId,
      }),
    [recipe, selectedBoneId, showSkeleton],
  );
  const selectedObject = selectedPartId
    ? built.partObjects[selectedPartId]
    : undefined;
  const selectedPart = selectedPartId
    ? recipe.parts[selectedPartId]
    : undefined;

  return (
    <Canvas camera={{ position: [0, 1.7, 4.2], fov: 38 }}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <primitive object={built.object} />
      {selectedPartId && selectedObject && transformMode !== "extrude" ? (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          onMouseUp={() => {
            const part = recipe.parts[selectedPartId];
            if (!part) return;
            const scale: AuthoredVector3 =
              transformMode === "scale"
                ? [
                    part.scale[0] * selectedObject.scale.x,
                    part.scale[1] * selectedObject.scale.y,
                    part.scale[2] * selectedObject.scale.z,
                  ]
                : part.scale;
            onPartTransformChange(selectedPartId, {
              position: [
                selectedObject.position.x,
                selectedObject.position.y,
                selectedObject.position.z,
              ],
              rotation: [
                selectedObject.rotation.x,
                selectedObject.rotation.y,
                selectedObject.rotation.z,
              ],
              scale,
            });
          }}
        />
      ) : null}
      {selectedObject && selectedPart && transformMode === "extrude" ? (
        <ExtrudeFaceHandles
          target={selectedObject}
          part={selectedPart}
          onExtrudeStart={onVisualExtrude}
          onExtrudeChange={onVisualExtrudeChange}
          onDragStateChange={setDraggingExtrude}
        />
      ) : null}
      <Grid infiniteGrid sectionColor="#5b6472" cellColor="#373d48" />
      <OrbitControls makeDefault enabled={!draggingExtrude} />
    </Canvas>
  );
}

const EXTRUDE_HANDLE_META: {
  face: AuthoredExtrudeFace;
  color: string;
}[] = [
  { face: "px", color: "#f87171" },
  { face: "nx", color: "#fca5a5" },
  { face: "py", color: "#4ade80" },
  { face: "ny", color: "#86efac" },
  { face: "pz", color: "#60a5fa" },
  { face: "nz", color: "#93c5fd" },
];

function ExtrudeFaceHandles({
  target,
  part,
  onExtrudeStart,
  onExtrudeChange,
  onDragStateChange,
}: {
  target: THREE.Object3D;
  part: AuthoredPart;
  onExtrudeStart: (face: AuthoredExtrudeFace) => string | undefined;
  onExtrudeChange: (extrusionId: string, distance: number) => void;
  onDragStateChange: (dragging: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const dragRef = useRef<{
    face: AuthoredExtrudeFace;
    extrusionId: string;
    distance: number;
  } | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    target.updateWorldMatrix(true, false);
    target.getWorldPosition(position);
    target.getWorldQuaternion(quaternion);
    groupRef.current.position.copy(position);
    groupRef.current.quaternion.copy(quaternion);
  });

  return (
    <group ref={groupRef}>
      {EXTRUDE_HANDLE_META.map((handle) => (
        <mesh
          key={handle.face}
          position={getExtrudeHandlePosition(part, handle.face)}
          renderOrder={50}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            const extrusionId = onExtrudeStart(handle.face);
            if (!extrusionId) return;
            dragRef.current = {
              face: handle.face,
              extrusionId,
              distance: 0.01,
            };
            onDragStateChange(true);
            (event.target as Element).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event: ThreeEvent<PointerEvent>) => {
            if (!dragRef.current || dragRef.current.face !== handle.face)
              return;
            event.stopPropagation();
            const movement = event.nativeEvent.movementY ?? 0;
            const nextDistance = clampExtrudeDistance(
              dragRef.current.distance - movement * 0.01,
            );
            dragRef.current.distance = nextDistance;
            onExtrudeChange(dragRef.current.extrusionId, nextDistance);
          }}
          onPointerUp={(event: ThreeEvent<PointerEvent>) => {
            if (!dragRef.current) return;
            event.stopPropagation();
            dragRef.current = null;
            onDragStateChange(false);
            (event.target as Element).releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event: ThreeEvent<PointerEvent>) => {
            if (!dragRef.current) return;
            event.stopPropagation();
            dragRef.current = null;
            onDragStateChange(false);
            (event.target as Element).releasePointerCapture?.(event.pointerId);
          }}
        >
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshBasicMaterial
            color={handle.color}
            depthTest={false}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

function PartInspector({
  recipe,
  part,
  onChange,
  onDuplicate,
  onDelete,
  onMirror,
  extrudeFace,
  extrudeDistance,
  extrudeScale,
  onExtrudeFaceChange,
  onExtrudeDistanceChange,
  onExtrudeScaleChange,
  onExtrude,
}: {
  recipe: AuthoredModelRecipe;
  part: AuthoredPart;
  onChange: (props: Partial<AuthoredPart>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMirror: () => void;
  extrudeFace: AuthoredExtrudeFace;
  extrudeDistance: number;
  extrudeScale: [number, number];
  onExtrudeFaceChange: (face: AuthoredExtrudeFace) => void;
  onExtrudeDistanceChange: (distance: number) => void;
  onExtrudeScaleChange: (scale: [number, number]) => void;
  onExtrude: () => void;
}) {
  return (
    <PanelBlock title={part.name}>
      <Input
        value={part.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={part.primitive}
          onValueChange={(value) =>
            onChange({ primitive: value as AuthoredPrimitiveKind })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-1000">
            {PRIMITIVES.map((primitive) => (
              <SelectItem key={primitive.value} value={primitive.value}>
                {primitive.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={part.boneId || AUTHORED_WORLD_BONE_ID}
          onValueChange={(boneId) => onChange({ boneId })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-1000">
            <SelectItem value={AUTHORED_WORLD_BONE_ID}>World root</SelectItem>
            {recipe.boneOrder.map((boneId) => (
              <SelectItem key={boneId} value={boneId}>
                {recipe.bones[boneId]?.name ?? boneId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <VectorEditor
        label="Position"
        value={part.position}
        step={0.01}
        onChange={(position) => onChange({ position })}
      />
      <VectorEditor
        label="Rotation"
        value={part.rotation}
        step={0.05}
        onChange={(rotation) => onChange({ rotation })}
      />
      <VectorEditor
        label="Scale"
        value={part.scale}
        step={0.02}
        min={0.01}
        onChange={(scale) => onChange({ scale })}
      />
      <div className="grid gap-2 rounded-md border bg-background p-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <HammerIcon className="size-3.5" />
          Extrude
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Select
            value={extrudeFace}
            onValueChange={(value) =>
              onExtrudeFaceChange(value as AuthoredExtrudeFace)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-1000">
              {EXTRUDE_FACES.map((face) => (
                <SelectItem key={face.value} value={face.value}>
                  {face.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NumberInput
            label="Distance"
            value={extrudeDistance}
            step={0.02}
            onChange={onExtrudeDistanceChange}
          />
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <NumberInput
            label="Face W"
            value={extrudeScale[0]}
            min={0.05}
            step={0.05}
            onChange={(value) => onExtrudeScaleChange([value, extrudeScale[1]])}
          />
          <NumberInput
            label="Face H"
            value={extrudeScale[1]}
            min={0.05}
            step={0.05}
            onChange={(value) => onExtrudeScaleChange([extrudeScale[0], value])}
          />
          <Button size="sm" variant="outline" onClick={onExtrude}>
            Add
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="outline" onClick={onMirror}>
          <FlipHorizontalIcon className="size-3.5" />
          Mirror
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <CopyIcon className="size-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          <Trash2Icon className="size-3.5" />
          Delete
        </Button>
      </div>
    </PanelBlock>
  );
}

function VectorEditor({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: AuthoredVector3;
  step: number;
  min?: number;
  onChange: (value: AuthoredVector3) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <NumberInput
            key={axis}
            label={axis}
            value={value[index]}
            step={step}
            min={min}
            onChange={(next) => {
              const vector: AuthoredVector3 = [...value];
              vector[index] = next;
              onChange(vector);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-[11px] font-medium text-muted-foreground">
      <span className="truncate">{label}</span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8"
      />
    </label>
  );
}

function getExtrudeHandlePosition(
  part: AuthoredPart,
  face: AuthoredExtrudeFace,
): AuthoredVector3 {
  const offset = 0.2;
  switch (face) {
    case "px":
      return [part.scale[0] / 2 + offset, 0, 0];
    case "nx":
      return [-(part.scale[0] / 2 + offset), 0, 0];
    case "py":
      return [0, part.scale[1] / 2 + offset, 0];
    case "ny":
      return [0, -(part.scale[1] / 2 + offset), 0];
    case "pz":
      return [0, 0, part.scale[2] / 2 + offset];
    case "nz":
      return [0, 0, -(part.scale[2] / 2 + offset)];
  }
}

function clampExtrudeDistance(distance: number) {
  if (!Number.isFinite(distance)) return 0.01;
  const clamped = Math.max(-3, Math.min(3, distance));
  if (Math.abs(clamped) < 0.01) return clamped < 0 ? -0.01 : 0.01;
  return clamped;
}

function PanelBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-md border bg-muted/10 p-3">
      <div className="text-xs font-semibold uppercase tracking-0 text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function boneDepth(recipe: AuthoredModelRecipe, bone: AuthoredBone) {
  let depth = 0;
  let current = bone;
  while (current.parentId && recipe.bones[current.parentId]) {
    depth += 1;
    current = recipe.bones[current.parentId];
  }
  return depth;
}

function primitiveLabel(primitive: AuthoredPrimitiveKind) {
  return primitive[0].toUpperCase() + primitive.slice(1);
}
