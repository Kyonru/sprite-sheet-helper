import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldContent } from "@/components/ui/field";
import { ChevronDownIcon, TrashIcon } from "lucide-react";
import { useSettingsStore, type SettingsState } from "@/store/next/settings";
import { useState, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import * as z from "zod";
import { ExportFormats, type ExportFormat } from "@/types/file";
import { GradientPicker } from "@/components/ui/gradient-picker";
import { Switch } from "@/components/ui/switch";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { setAppTitle } from "@/utils/app.web";
import { exporters } from "@/utils/exports";

const formSchema = z.object({
  name: z.string(),
  mode: z.enum(ExportFormats),
  width: z.coerce.number().min(1),
  height: z.coerce.number().min(1),
  exportWidth: z.coerce.number().min(1),
  exportHeight: z.coerce.number().min(1),
  cameraDistance: z.coerce.number().min(0),
  cameraAngle: z.string().optional(),
  editorBackgroundColor: z.string(),
  gridSectionColor: z.string(),
  gridCellColor: z.string(),
  theme: z.enum(["light", "dark"]),
});

type FormValues = z.infer<typeof formSchema>;

type SettingsModalState = {
  open: boolean;
  defaultValues?: Partial<FormValues>;
};

type Listener = (state: SettingsModalState) => void;
let _listener: Listener | null = null;

function dispatch(state: SettingsModalState) {
  _listener?.(state);
}

// eslint-disable-next-line react-refresh/only-export-components
export function openSettings(options?: Omit<SettingsModalState, "open">) {
  dispatch({ open: true, ...options });
}

export function SettingsModalProvider() {
  const settings = useSettingsStore((state) => state);
  const updateSettings = useSettingsStore((state) => state.update);
  const [state, setState] = useState<SettingsModalState>({ open: false });
  const { setTheme } = useTheme();
  const originalThemeRef = useRef<"light" | "dark">(settings.theme);
  const originalBgRef = useRef<string>(settings.editorBackgroundColor);

  const originalGridSectionRef = useRef<string>(settings.gridSectionColor);
  const originalGridCellRef = useRef<string>(settings.gridCellColor);

  useEffect(() => {
    _listener = (next) => setState(next);
    return () => {
      _listener = null;
    };
  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: settings.name,
      mode: settings.mode,
      width: settings.width,
      height: settings.height,
      exportWidth: settings.exportWidth,
      exportHeight: settings.exportHeight,
      cameraDistance: settings.cameraDistance,
      cameraAngle: `${settings.cameraAngle}`,
      editorBackgroundColor: settings.editorBackgroundColor,
      gridSectionColor: settings.gridSectionColor,
      gridCellColor: settings.gridCellColor,
      theme: settings.theme,
    },
  });

  // Re-sync form with store each time the modal opens
  useEffect(() => {
    if (state.open) {
      originalThemeRef.current = settings.theme;
      originalBgRef.current = settings.editorBackgroundColor;
      originalGridSectionRef.current = settings.gridSectionColor;
      originalGridCellRef.current = settings.gridCellColor;
      form.reset({
        name: settings.name,
        mode: settings.mode,
        width: settings.width,
        height: settings.height,
        exportWidth: settings.exportWidth,
        exportHeight: settings.exportHeight,
        cameraDistance: settings.cameraDistance,
        cameraAngle: `${settings.cameraAngle}`,
        editorBackgroundColor: settings.editorBackgroundColor,
        gridSectionColor: settings.gridSectionColor,
        gridCellColor: settings.gridCellColor,
        theme: settings.theme,
      });
    }
  }, [form, settings, state.open]);

  const onClose = () => {
    setTheme(originalThemeRef.current);
    updateSettings({
      editorBackgroundColor: originalBgRef.current,
      gridSectionColor: originalGridSectionRef.current,
      gridCellColor: originalGridCellRef.current,
    });
    setState((s) => ({ ...s, open: false }));
  };

  function onSubmit(data: FormValues) {
    updateSettings({
      ...data,
      cameraAngle:
        data.cameraAngle !== undefined && data.cameraAngle !== ""
          ? parseFloat(data.cameraAngle)
          : undefined,
    } as SettingsState);
    originalThemeRef.current = data.theme as Exclude<Theme, "system">;
    originalBgRef.current = data.editorBackgroundColor as string;
    originalGridSectionRef.current = data.gridSectionColor as string;
    originalGridCellRef.current = data.gridCellColor as string;

    setAppTitle(data.name);
    onClose();
  }

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs overflow-scroll">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg z-999 flex flex-col max-h-[95vh] animate-bounce">
          <form
            id="settings-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col min-h-0 flex-1"
          >
            <DialogHeader className="shrink-0">
              <DialogTitle>Export Settings</DialogTitle>
              <DialogDescription>
                Adjust canvas, export dimensions, and camera settings.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="mt-4 overflow-y-auto min-h-0">
              {/* ── Project ── */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Project
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 gap-4 pt-3">
                    <Controller
                      name="name"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="project-name">Name</FieldLabel>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Input
                            {...field}
                            value={field.value}
                            id="project-name"
                            min={1}
                            aria-invalid={fieldState.invalid}
                          />
                        </Field>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Canvas ── */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Preview Canvas
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-4 pt-3">
                    <Controller
                      name="width"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-width">
                              Width
                            </FieldLabel>
                            <FieldDescription>
                              Canvas width in pixels.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Input
                            {...field}
                            value={field.value as number}
                            id="settings-width"
                            type="number"
                            min={1}
                            aria-invalid={fieldState.invalid}
                          />
                        </Field>
                      )}
                    />
                    <Controller
                      name="height"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-height">
                              Height
                            </FieldLabel>
                            <FieldDescription>
                              Canvas height in pixels.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Input
                            {...field}
                            value={field.value as number}
                            id="settings-height"
                            type="number"
                            min={1}
                            aria-invalid={fieldState.invalid}
                          />
                        </Field>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Export ── */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Export
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FieldGroup className="pt-3">
                    <Controller
                      name="mode"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field
                          data-invalid={fieldState.invalid}
                          orientation="horizontal"
                        >
                          <FieldContent>
                            <FieldLabel htmlFor="settings-mode">
                              Format
                            </FieldLabel>
                            <FieldDescription>
                              Output file type for the exported animation.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Select
                            name={field.name}
                            value={field.value as ExportFormat}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="settings-mode"
                              aria-invalid={fieldState.invalid}
                              className="min-w-30"
                            >
                              <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(exporters).map((exp) => (
                                <SelectItem key={exp.id} value={exp.id}>
                                  {exp.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Controller
                        name="exportWidth"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldContent>
                              <FieldLabel htmlFor="settings-export-width">
                                Width
                              </FieldLabel>
                              <FieldDescription>
                                Output width in pixels.
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>
                            <Input
                              {...field}
                              value={field.value as number}
                              id="settings-export-width"
                              type="number"
                              min={1}
                              aria-invalid={fieldState.invalid}
                            />
                          </Field>
                        )}
                      />
                      <Controller
                        name="exportHeight"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldContent>
                              <FieldLabel htmlFor="settings-export-height">
                                Height
                              </FieldLabel>
                              <FieldDescription>
                                Output height in pixels.
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>
                            <Input
                              {...field}
                              value={field.value as number}
                              id="settings-export-height"
                              type="number"
                              min={1}
                              aria-invalid={fieldState.invalid}
                            />
                          </Field>
                        )}
                      />
                    </div>
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Camera ── */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Camera
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      name="cameraDistance"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-camera-distance">
                              Distance
                            </FieldLabel>
                            <FieldDescription>
                              Distance of the camera from the scene origin.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <Input
                            {...field}
                            value={field.value as number}
                            id="settings-camera-distance"
                            type="number"
                            min={0}
                            aria-invalid={fieldState.invalid}
                          />
                        </Field>
                      )}
                    />

                    {/* Camera Angle */}
                    <Controller
                      name="cameraAngle"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-camera-angle">
                              Angle Override
                            </FieldLabel>
                            <FieldDescription>
                              Camera angle in degrees.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>

                          <div className="flex items-center gap-2 flex-row">
                            <Input
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              value={
                                field.value === undefined ? "" : field.value
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value ? value : "");
                              }}
                              id="settings-camera-angle"
                              type="number"
                              placeholder="None"
                              aria-invalid={fieldState.invalid}
                            />

                            <button
                              type="button"
                              className="p-1 hover:bg-muted rounded transition-colors"
                              onClick={() => {
                                field.onChange("");
                              }}
                              title="Clear angle override"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </Field>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Appearance ── */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Appearance
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FieldGroup className="pt-3">
                    {/* Theme */}
                    <Controller
                      name="theme"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field
                          data-invalid={fieldState.invalid}
                          orientation="horizontal"
                        >
                          <FieldContent>
                            <FieldLabel htmlFor="settings-theme">
                              Theme
                            </FieldLabel>
                            <FieldDescription>
                              Switch between light and dark editor theme.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <div className="flex items-center gap-2 shrink-0">
                            <SunIcon className="size-4 text-muted-foreground" />
                            <Switch
                              id="settings-theme"
                              aria-invalid={fieldState.invalid}
                              checked={field.value === "dark"}
                              onCheckedChange={(checked) => {
                                const next = checked ? "dark" : "light";
                                field.onChange(next);
                                setTheme(next);
                              }}
                            />
                            <MoonIcon className="size-4 text-muted-foreground" />
                          </div>
                        </Field>
                      )}
                    />
                    {/* Background */}
                    <Controller
                      name="editorBackgroundColor"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-bg-color">
                              Background
                            </FieldLabel>
                            <FieldDescription>
                              Editor background color or gradient.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <GradientPicker
                            showGradient={false}
                            id="settings-bg-color"
                            className="w-full truncate"
                            background={field.value as string}
                            setBackground={(value) => {
                              field.onChange(value);
                              updateSettings({ editorBackgroundColor: value });
                            }}
                          />
                        </Field>
                      )}
                    />
                    {/* Grid Section Color */}
                    <Controller
                      name="gridSectionColor"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-grid-section-color">
                              Grid Section
                            </FieldLabel>
                            <FieldDescription>
                              Color of the major grid section lines.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <GradientPicker
                            showGradient={false}
                            id="settings-grid-section-color"
                            className="w-full truncate"
                            background={field.value as string}
                            setBackground={(value) => {
                              field.onChange(value);
                              updateSettings({ gridSectionColor: value });
                            }}
                          />
                        </Field>
                      )}
                    />
                    {/* Grid Cell Color */}
                    <Controller
                      name="gridCellColor"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldContent>
                            <FieldLabel htmlFor="settings-grid-cell-color">
                              Grid Cell
                            </FieldLabel>
                            <FieldDescription>
                              Color of the minor grid cell lines.
                            </FieldDescription>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </FieldContent>
                          <GradientPicker
                            showGradient={false}
                            id="settings-grid-cell-color"
                            className="w-full truncate"
                            background={field.value as string}
                            setBackground={(value) => {
                              field.onChange(value);
                              updateSettings({ gridCellColor: value });
                            }}
                          />
                        </Field>
                      )}
                    />
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            </FieldGroup>

            <DialogFooter className="mt-6 shrink-0">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="settings-form">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
}
