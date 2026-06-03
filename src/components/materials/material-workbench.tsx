import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CopyIcon,
  EraserIcon,
  Layers3Icon,
  PaletteIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useEntitiesStore } from "@/store/next/entities";
import {
  EMPTY_MATERIAL_INVENTORY,
  useMaterialsStore,
} from "@/store/next/materials";
import type {
  MaterialAsset,
  MaterialInventoryItem,
  MaterialMapKind,
} from "@/types/materials";

type MaterialsWorkbenchState = {
  open: boolean;
  modelUuid?: string;
};

type Listener = (state: MaterialsWorkbenchState) => void;
let _listener: Listener | null = null;

function dispatch(state: MaterialsWorkbenchState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openMaterialsWorkbench(modelUuid?: string) {
  dispatch({ open: true, modelUuid });
}

const MAP_KINDS: { key: MaterialMapKind; label: string }[] = [
  { key: "albedo", label: "Albedo" },
  { key: "normal", label: "Normal" },
  { key: "roughness", label: "Roughness" },
  { key: "metalness", label: "Metalness" },
  { key: "ao", label: "AO" },
  { key: "emissive", label: "Emissive" },
];

export function MaterialsWorkbenchProvider() {
  const [state, setState] = useState<MaterialsWorkbenchState>({ open: false });

  useEffect(() => {
    _listener = setState;
    return () => {
      _listener = null;
    };
  }, []);

  return createPortal(
    <Dialog
      open={state.open}
      onOpenChange={(open) => setState((current) => ({ ...current, open }))}
    >
      <DialogContent className="flex h-[86vh] max-w-[min(1440px,calc(100vw-32px))] grid-rows-[auto_minmax(0,1fr)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4" />
            Materials Workbench
          </DialogTitle>
          <DialogDescription>
            Edit reusable materials, assign them to imported model slots, and
            generate non-destructive retro texture variants.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-4">
          <MaterialsPanel initialModelUuid={state.modelUuid} />
        </div>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}

export function MaterialsPanel({
  initialModelUuid,
  compact = false,
}: {
  initialModelUuid?: string;
  compact?: boolean;
}) {
  const entities = useEntitiesStore((state) => state.entities);
  const selectedEntity = useEntitiesStore((state) => state.selected);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const modelOptions = useMemo(
    () =>
      Object.values(entities).filter((entity) => entity.type === "model"),
    [entities],
  );
  const selectedModelFallback =
    initialModelUuid ??
    (selectedEntity && entities[selectedEntity]?.type === "model"
      ? selectedEntity
      : undefined) ??
    modelOptions[0]?.uuid;
  const [modelUuid, setModelUuid] = useState<string | undefined>(
    selectedModelFallback,
  );
  const [slotSearch, setSlotSearch] = useState("");

  useEffect(() => {
    if (!modelUuid && selectedModelFallback) setModelUuid(selectedModelFallback);
  }, [modelUuid, selectedModelFallback]);

  const inventory = useMaterialsStore(
    (state) =>
      modelUuid
        ? state.inventories[modelUuid] ?? EMPTY_MATERIAL_INVENTORY
        : EMPTY_MATERIAL_INVENTORY,
  );
  const assignments = useMaterialsStore((state) => state.assignments);
  const materials = useMaterialsStore((state) => state.materials);
  const textures = useMaterialsStore((state) => state.textures);
  const selectedMaterialId = useMaterialsStore(
    (state) => state.selectedMaterialId,
  );
  const selectedAssignmentId = useMaterialsStore(
    (state) => state.selectedAssignmentId,
  );
  const createMaterial = useMaterialsStore((state) => state.createMaterial);
  const duplicateMaterial = useMaterialsStore(
    (state) => state.duplicateMaterial,
  );
  const removeMaterial = useMaterialsStore((state) => state.removeMaterial);
  const updateMaterial = useMaterialsStore((state) => state.updateMaterial);
  const setSelectedMaterial = useMaterialsStore(
    (state) => state.setSelectedMaterial,
  );
  const setSelectedAssignment = useMaterialsStore(
    (state) => state.setSelectedAssignment,
  );
  const setMaterialAssignment = useMaterialsStore(
    (state) => state.setMaterialAssignment,
  );
  const removeMaterialAssignment = useMaterialsStore(
    (state) => state.removeMaterialAssignment,
  );
  const resetModelMaterials = useMaterialsStore(
    (state) => state.resetModelMaterials,
  );
  const addTextureAsset = useMaterialsStore((state) => state.addTextureAsset);
  const generateTextureVariant = useMaterialsStore(
    (state) => state.generateTextureVariant,
  );

  const selectedMaterial = selectedMaterialId
    ? materials[selectedMaterialId]
    : undefined;
  const filteredInventory = useMemo(() => {
    const needle = slotSearch.trim().toLowerCase();
    if (!needle) return inventory;
    return inventory.filter((item) => {
      const assignment = assignments[item.id];
      const material = assignment ? materials[assignment.materialId] : undefined;
      return [
        item.meshName,
        item.meshPath,
        item.originalMaterialName,
        material?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [assignments, inventory, materials, slotSearch]);
  const selectedSlot =
    inventory.find((item) => item.id === selectedAssignmentId) ?? inventory[0];

  useEffect(() => {
    if (!selectedAssignmentId && selectedSlot) {
      setSelectedAssignment(selectedSlot.id);
    }
  }, [selectedAssignmentId, selectedSlot, setSelectedAssignment]);

  const applyToSlot = (slot: MaterialInventoryItem | undefined) => {
    if (!slot || !modelUuid || !selectedMaterial) return;
    setMaterialAssignment({
      modelUuid,
      meshPath: slot.meshPath,
      meshName: slot.meshName,
      materialSlot: slot.materialSlot,
      materialId: selectedMaterial.uuid,
    });
  };

  const applyToMesh = () => {
    if (!selectedSlot || !modelUuid || !selectedMaterial) return;
    inventory
      .filter((item) => item.meshPath === selectedSlot.meshPath)
      .forEach((item) => applyToSlot(item));
  };

  const applyToModel = () => {
    inventory.forEach((item) => applyToSlot(item));
  };

  const resetSlot = () => {
    if (!selectedSlot || !modelUuid) return;
    removeMaterialAssignment(
      modelUuid,
      selectedSlot.meshPath,
      selectedSlot.materialSlot,
    );
  };

  if (modelOptions.length === 0) {
    return (
      <div className="grid h-full place-items-center rounded-md border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        Import a model before editing materials.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 gap-3",
        compact
          ? "auto-rows-min grid-cols-1 overflow-y-auto pr-1"
          : "auto-rows-min grid-cols-1 overflow-y-auto pr-1 xl:auto-rows-fr xl:grid-cols-[minmax(220px,0.85fr)_minmax(260px,1fr)_minmax(320px,1.1fr)] xl:overflow-hidden xl:pr-0",
      )}
    >
      <section className="flex min-h-[220px] min-w-0 flex-col overflow-hidden rounded-md border bg-background xl:min-h-0">
        <PanelHeader icon={<Layers3Icon className="size-4" />} title="Slots" />
        <div className="grid shrink-0 gap-2 border-b p-3">
          <Select value={modelUuid} onValueChange={setModelUuid}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((model) => (
                <SelectItem key={model.uuid} value={model.uuid}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={slotSearch}
            onChange={(event) => setSlotSearch(event.target.value)}
            placeholder="Search mesh or material..."
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!modelUuid}
            onClick={() => modelUuid && resetModelMaterials(modelUuid)}
          >
            <EraserIcon className="size-3.5" />
            Reset Model
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {inventory.length === 0 ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Material slots will appear after the model finishes loading.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {filteredInventory.map((item) => {
                const assignment = assignments[item.id];
                const material = assignment
                  ? materials[assignment.materialId]
                  : undefined;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "min-w-0 rounded-md border px-2 py-2 text-left text-xs transition-colors",
                      item.id === selectedAssignmentId
                        ? "border-primary bg-primary/10"
                        : "bg-muted/10 hover:bg-muted/50",
                    )}
                    onClick={() => {
                      setSelectedAssignment(item.id);
                      if (modelUuid) selectEntity(modelUuid);
                      if (material) setSelectedMaterial(material.uuid);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {item.meshName}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        Slot {item.materialSlot + 1}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-muted-foreground">
                      {material?.name ?? item.originalMaterialName}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-[260px] min-w-0 flex-col overflow-hidden rounded-md border bg-background xl:min-h-0">
        <PanelHeader icon={<PaletteIcon className="size-4" />} title="Library" />
        <div className="shrink-0 border-b p-3">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <span
                className="size-10 rounded-md border"
                style={{
                  background: selectedMaterial?.color ?? "transparent",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {selectedMaterial?.name ?? "No material selected"}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedSlot
                    ? `${selectedSlot.meshName} · slot ${selectedSlot.materialSlot + 1}`
                    : "No material slot selected"}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                  Original: {selectedSlot?.originalMaterialName ?? "None"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid shrink-0 gap-2 border-b p-3">
          <Button
            size="sm"
            className="min-w-0"
            onClick={() => createMaterial({ name: "Material" })}
          >
            <PlusIcon className="size-3.5" />
            New Material
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {Object.values(materials).length === 0 ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              Create a material to start editing.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {Object.values(materials).map((material) => (
                <button
                  key={material.uuid}
                  type="button"
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border px-2 py-2 text-left",
                    material.uuid === selectedMaterialId
                      ? "border-primary bg-primary/10"
                      : "bg-muted/10 hover:bg-muted/50",
                  )}
                  onClick={() => setSelectedMaterial(material.uuid)}
                >
                  <span
                    className="mt-0.5 size-5 rounded border"
                    style={{ background: material.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {material.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {material.lightingMode} · {material.textureSize}px ·{" "}
                      {material.paletteColors} colors
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-md border bg-background xl:min-h-0">
        <PanelHeader icon={<SparklesIcon className="size-4" />} title="Edit" />
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!selectedMaterial ? (
            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              Select or create a material.
            </div>
          ) : (
            <MaterialEditor
              material={selectedMaterial}
              textures={textures}
              onChange={(props) => updateMaterial(selectedMaterial.uuid, props)}
              onDuplicate={() => duplicateMaterial(selectedMaterial.uuid)}
              onRemove={() => removeMaterial(selectedMaterial.uuid)}
              onApplySlot={() => applyToSlot(selectedSlot)}
              onApplyMesh={applyToMesh}
              onApplyModel={applyToModel}
              onResetSlot={resetSlot}
              onUploadTexture={async (kind, file) => {
                const textureId = await addTextureAsset(file);
                if (!textureId) return;
                updateMaterial(selectedMaterial.uuid, {
                  textureRefs: {
                    ...selectedMaterial.textureRefs,
                    [kind]: textureId,
                  },
                });
              }}
              onGenerateVariant={async (kind) => {
                const textureId = selectedMaterial.textureRefs[kind];
                if (!textureId) return;
                const nextTextureId = await generateTextureVariant(textureId, {
                  targetSize: selectedMaterial.textureSize,
                  paletteColors: selectedMaterial.paletteColors,
                  dither: selectedMaterial.dithering,
                  nearest: selectedMaterial.nearestFiltering,
                });
                if (!nextTextureId) return;
                updateMaterial(selectedMaterial.uuid, {
                  textureRefs: {
                    ...selectedMaterial.textureRefs,
                    [kind]: nextTextureId,
                  },
                });
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function MaterialEditor({
  material,
  textures,
  onChange,
  onDuplicate,
  onRemove,
  onApplySlot,
  onApplyMesh,
  onApplyModel,
  onResetSlot,
  onUploadTexture,
  onGenerateVariant,
}: {
  material: MaterialAsset;
  textures: ReturnType<typeof useMaterialsStore.getState>["textures"];
  onChange: (props: Partial<MaterialAsset>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onApplySlot: () => void;
  onApplyMesh: () => void;
  onApplyModel: () => void;
  onResetSlot: () => void;
  onUploadTexture: (kind: MaterialMapKind, file: File) => void | Promise<void>;
  onGenerateVariant: (kind: MaterialMapKind) => void | Promise<void>;
}) {
  return (
    <Tabs defaultValue="details" className="min-h-0 min-w-0">
      <TabsList className="grid w-full min-w-0 grid-cols-3">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="textures">Textures</TabsTrigger>
        <TabsTrigger value="assign">Assign</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="mt-3 grid min-w-0 gap-3">
        <label className="grid gap-1.5 text-xs font-medium">
          Name
          <Input
            className="min-w-0"
            value={material.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
          <label className="grid gap-1.5 text-xs font-medium">
            Color
            <Input
              className="min-w-0"
              type="color"
              value={material.color}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Lighting
            <Select
              value={material.lightingMode}
              onValueChange={(value) =>
                onChange({
                  lightingMode: value as MaterialAsset["lightingMode"],
                })
              }
            >
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pbr">PBR</SelectItem>
                <SelectItem value="unlit">Unlit</SelectItem>
                <SelectItem value="flat">Flat Lit</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <NumberField
          label="Opacity"
          value={material.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(opacity) => onChange({ opacity })}
        />
        <NumberField
          label="Roughness"
          value={material.roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={(roughness) => onChange({ roughness })}
        />
        <NumberField
          label="Metalness"
          value={material.metalness}
          min={0}
          max={1}
          step={0.01}
          onChange={(metalness) => onChange({ metalness })}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
          <ToggleRow
            label="Transparent"
            checked={material.transparent}
            onCheckedChange={(transparent) => onChange({ transparent })}
          />
          <ToggleRow
            label="Flat shading"
            checked={material.flatShading}
            onCheckedChange={(flatShading) => onChange({ flatShading })}
          />
          <ToggleRow
            label="Wireframe"
            checked={material.wireframe}
            onCheckedChange={(wireframe) => onChange({ wireframe })}
          />
          <ToggleRow
            label="Nearest"
            checked={material.nearestFiltering}
            onCheckedChange={(nearestFiltering) =>
              onChange({ nearestFiltering })
            }
          />
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="min-w-0"
            onClick={onDuplicate}
          >
            <CopyIcon className="size-3.5" />
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-w-0"
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" />
            Delete
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="textures" className="mt-3 grid min-w-0 gap-3">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
          <NumberField
            label="Retro Size"
            value={material.textureSize}
            min={16}
            max={1024}
            step={16}
            onChange={(textureSize) => onChange({ textureSize })}
          />
          <NumberField
            label="Palette Colors"
            value={material.paletteColors}
            min={2}
            max={256}
            step={1}
            onChange={(paletteColors) => onChange({ paletteColors })}
          />
        </div>
        <ToggleRow
          label="Dither generated variants"
          checked={material.dithering}
          onCheckedChange={(dithering) => onChange({ dithering })}
        />
        <div className="grid min-w-0 gap-2">
          {MAP_KINDS.map(({ key, label }) => {
            const textureId = material.textureRefs[key];
            const texture = textureId ? textures[textureId] : undefined;
            return (
              <div key={key} className="min-w-0 rounded-md border p-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{label}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {texture
                        ? `${texture.name} · ${texture.width ?? "?"}x${texture.height ?? "?"}`
                        : "No map assigned"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={!texture}
                    onClick={() => onGenerateVariant(key)}
                  >
                    <RefreshCwIcon className="size-3.5" />
                    Retro
                  </Button>
                </div>
                <label className="mt-2 flex min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-xs hover:bg-muted/50">
                  <UploadIcon className="size-3.5 shrink-0" />
                  <span className="truncate">Upload {label}</span>
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void onUploadTexture(key, file);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="assign" className="mt-3 grid min-w-0 gap-2">
        <Button size="sm" className="min-w-0" onClick={onApplySlot}>
          Apply to selected slot
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0"
          onClick={onApplyMesh}
        >
          Apply to selected mesh
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0"
          onClick={onApplyModel}
        >
          Apply to whole model
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0"
          onClick={onResetSlot}
        >
          <EraserIcon className="size-3.5" />
          Reset selected slot
        </Button>
      </TabsContent>
    </Tabs>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {value}
        </span>
      </span>
      <Input
        className="min-w-0"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-2 text-xs">
      <span className="min-w-0 truncate">{label}</span>
      <Switch
        className="shrink-0"
        size="sm"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
      />
    </label>
  );
}

function PanelHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 border-b px-3 py-2 text-sm font-medium">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{title}</span>
    </div>
  );
}
