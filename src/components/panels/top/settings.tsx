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
import { ChevronDownIcon } from "lucide-react";
import { useSettingsStore, type SettingsState } from "@/store/next/settings";
import { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { createPortal } from "react-dom";
import * as z from "zod";
import type { ExportFormat } from "@/types/file";

const ExportFormats = ["spritesheet", "gif", "zip"];

const formSchema = z.object<{ [K in keyof SettingsState]: z.ZodTypeAny }>({
  mode: z.enum(ExportFormats as ExportFormat[]),
  width: z.coerce.number().min(1),
  height: z.coerce.number().min(1),
  exportWidth: z.coerce.number().min(1),
  exportHeight: z.coerce.number().min(1),
  cameraDistance: z.coerce.number().min(0),
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

  useEffect(() => {
    _listener = (next) => setState(next);
    return () => {
      _listener = null;
    };
  }, []);

  const onClose = () => setState((s) => ({ ...s, open: false }));
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: settings.mode,
      width: settings.width,
      height: settings.height,
      exportWidth: settings.exportWidth,
      exportHeight: settings.exportHeight,
      cameraDistance: settings.cameraDistance,
    },
  });

  // Re-sync form with store each time the modal opens
  useEffect(() => {
    if (state.open) {
      form.reset({
        mode: settings.mode,
        width: settings.width,
        height: settings.height,
        exportWidth: settings.exportWidth,
        exportHeight: settings.exportHeight,
        cameraDistance: settings.cameraDistance,
      });
    }
  }, [
    form,
    settings.cameraDistance,
    settings.exportHeight,
    settings.exportWidth,
    settings.height,
    settings.mode,
    settings.width,
    state.open,
  ]);

  function onSubmit(data: FormValues) {
    updateSettings(data as SettingsState);
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
              {/* ── Canvas ── */}
              <Collapsible defaultOpen>
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

              <hr className="border-border" />

              {/* ── Export ── */}
              <Collapsible defaultOpen>
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
                              className="min-w-[120px]"
                            >
                              <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                              {ExportFormats.map((fmt) => (
                                <SelectItem key={fmt} value={fmt}>
                                  {fmt}
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

              <hr className="border-border" />

              {/* ── Camera ── */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                  Camera
                  <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pt-3">
                    <Controller
                      name="cameraDistance"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field
                          data-invalid={fieldState.invalid}
                          orientation="horizontal"
                        >
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
                            className="max-w-24"
                          />
                        </Field>
                      )}
                    />
                  </div>
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
