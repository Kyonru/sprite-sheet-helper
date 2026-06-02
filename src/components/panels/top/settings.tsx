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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldContent } from "@/components/ui/field";
import {
  AppWindowIcon,
  CameraIcon,
  FileArchiveIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RulerIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  SunIcon,
  TrashIcon,
  type LucideIcon,
} from "lucide-react";
import { useSettingsStore, type SettingsState } from "@/store/next/settings";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import * as z from "zod";
import { ExportFormats, type ExportFormat } from "@/types/file";
import { GradientPicker } from "@/components/ui/gradient-picker";
import { Switch } from "@/components/ui/switch";
import { useTheme, type Theme } from "@/components/theme-provider";
import { setAppTitle } from "@/utils/app.web";
import { exporters } from "@/utils/exports";
import { cn } from "@/lib/utils";

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

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border bg-background", className)}>
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <span className="mt-0.5 rounded-md border bg-muted/30 p-1.5">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
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
      cameraAngle:
        settings.cameraAngle === undefined ? "" : `${settings.cameraAngle}`,
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
        cameraAngle:
          settings.cameraAngle === undefined ? "" : `${settings.cameraAngle}`,
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

  const values = form.watch();
  const selectedExporter = exporters[values.mode as ExportFormat];
  const hasUnsavedChanges = form.formState.isDirty;

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 overflow-hidden backdrop-blur-xs">
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="z-999 flex h-[min(92vh,860px)] w-[calc(100vw-1rem)] max-w-[1040px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-1rem)] xl:max-w-[1040px]">
          <form
            id="settings-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogHeader className="shrink-0 border-b px-5 py-4 pe-12">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="flex items-center gap-2">
                  <Settings2Icon className="size-5" />
                  Settings
                </DialogTitle>
                {hasUnsavedChanges && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Unsaved changes
                  </span>
                )}
              </div>
              <DialogDescription>
                Tune project defaults, preview size, export output, camera, and
                appearance.
              </DialogDescription>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile
                  icon={AppWindowIcon}
                  label="Project"
                  value={values.name || "Untitled"}
                />
                <SummaryTile
                  icon={FileArchiveIcon}
                  label="Export"
                  value={selectedExporter?.label ?? values.mode}
                />
                <SummaryTile
                  icon={MonitorIcon}
                  label="Preview"
                  value={`${values.width || 0}x${values.height || 0}`}
                />
                <SummaryTile
                  icon={PaletteIcon}
                  label="Theme"
                  value={values.theme === "dark" ? "Dark" : "Light"}
                />
              </div>
            </DialogHeader>

            <Tabs
              defaultValue="project"
              className="min-h-0 flex-1 gap-0 bg-muted/20"
            >
              <div className="shrink-0 border-b bg-background px-4 py-3">
                <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-5">
                  <TabsTrigger value="project" className="gap-2">
                    <AppWindowIcon className="size-4" />
                    Project
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <MonitorIcon className="size-4" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="export" className="gap-2">
                    <FileArchiveIcon className="size-4" />
                    Export
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="gap-2">
                    <CameraIcon className="size-4" />
                    Camera
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className="gap-2">
                    <PaletteIcon className="size-4" />
                    Look
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <TabsContent value="project" className="mt-0">
                  <SettingsSection
                    icon={AppWindowIcon}
                    title="Project"
                    description="Name the workspace shown in the window and saved project state."
                  >
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
                  </SettingsSection>
                </TabsContent>

                <TabsContent value="preview" className="mt-0">
                  <SettingsSection
                    icon={MonitorIcon}
                    title="Preview Canvas"
                    description="Set the live editor canvas dimensions."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
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
                  </SettingsSection>
                </TabsContent>

                <TabsContent value="export" className="mt-0">
                  <div className="grid gap-4">
                    <SettingsSection
                      icon={FileArchiveIcon}
                      title="Default Export"
                      description="Choose the default exporter and sprite output dimensions."
                    >
                      <FieldGroup className="gap-4">
                        <Controller
                          name="mode"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid}
                              orientation="responsive"
                            >
                              <FieldContent>
                                <FieldLabel htmlFor="settings-mode">
                                  Format
                                </FieldLabel>
                                <FieldDescription>
                                  Output package used by the export workbench.
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
                                  className="w-full sm:w-[220px]"
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
                        <div className="grid gap-4 sm:grid-cols-2">
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
                    </SettingsSection>
                  </div>
                </TabsContent>

                <TabsContent value="camera" className="mt-0">
                  <SettingsSection
                    icon={CameraIcon}
                    title="Camera"
                    description="Set default framing used by capture and workflow output."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
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
                                Distance from the scene origin.
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
                                Optional camera angle in degrees.
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </FieldContent>

                            <div className="flex items-center gap-2">
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

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  field.onChange("");
                                }}
                                title="Clear angle override"
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </div>
                          </Field>
                        )}
                      />
                    </div>
                  </SettingsSection>
                </TabsContent>

                <TabsContent value="appearance" className="mt-0">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <SettingsSection
                      icon={PaletteIcon}
                      title="Appearance"
                      description="Change editor theme and viewport colors."
                    >
                      <FieldGroup className="gap-4">
                        <Controller
                          name="theme"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid}
                              orientation="responsive"
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
                              <div className="flex shrink-0 items-center gap-2 rounded-md border px-3 py-2">
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
                                  Editor background color.
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
                                  updateSettings({
                                    editorBackgroundColor: value,
                                  });
                                }}
                              />
                            </Field>
                          )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
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
                                    Major grid lines.
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
                                    updateSettings({
                                      gridSectionColor: value,
                                    });
                                  }}
                                />
                              </Field>
                            )}
                          />
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
                                    Minor grid lines.
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
                        </div>
                      </FieldGroup>
                    </SettingsSection>

                    <SettingsSection
                      icon={RulerIcon}
                      title="Color Roles"
                      description="Current viewport colors."
                    >
                      <div className="grid gap-3 text-xs">
                        {[
                          ["Background", values.editorBackgroundColor],
                          ["Grid section", values.gridSectionColor],
                          ["Grid cell", values.gridCellColor],
                        ].map(([label, color]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                          >
                            <span className="text-muted-foreground">
                              {label}
                            </span>
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-5 shrink-0 rounded border"
                                style={{ background: color }}
                              />
                              <span className="truncate font-mono">
                                {color}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="shrink-0 border-t bg-background px-5 py-4">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="settings-form" className="gap-2">
                <SlidersHorizontalIcon className="size-4" />
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
