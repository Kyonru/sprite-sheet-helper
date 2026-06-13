import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type InspectorValue = string | number | boolean;
type SelectInspectorField = Extract<InspectorField, { kind: "select" }>;

export type InspectorOption =
  | InspectorValue
  | {
      label: string;
      value: InspectorValue;
    };

export type InspectorField =
  | {
      kind: "group";
      label: string;
      description?: string;
      fields: InspectorField[];
      hidden?: boolean;
    }
  | {
      kind: "readonly";
      label: string;
      value: React.ReactNode;
      hidden?: boolean;
    }
  | {
      kind: "text";
      label: string;
      value: string;
      onChange: (value: string) => void;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "number";
      label: string;
      value: number;
      onChange: (value: number) => void;
      min?: number;
      max?: number;
      step?: number;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "range";
      label: string;
      value: [number, number];
      onChange: (value: [number, number]) => void;
      min?: number;
      max?: number;
      step?: number;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "vector3";
      label: string;
      value: [number, number, number];
      onChange: (value: [number, number, number]) => void;
      step?: number;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "boolean";
      label: string;
      value: boolean;
      onChange: (value: boolean) => void;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "select";
      label: string;
      value: InspectorValue;
      options: InspectorOption[] | Record<string, InspectorValue>;
      onChange: (value: InspectorValue) => void;
      disabled?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "button";
      label: string;
      action: () => void | Promise<void>;
      disabled?: boolean;
      variant?: React.ComponentProps<typeof Button>["variant"];
      hidden?: boolean;
    }
  | {
      kind: "color";
      label: string;
      value: string;
      onChange: (value: string) => void;
      disabled?: boolean;
      hidden?: boolean;
    };

function optionEntries(options: SelectInspectorField) {
  const rawOptions = Array.isArray(options.options)
    ? options.options
    : Object.entries(options.options).map(([label, value]) => ({
        label,
        value,
      }));

  return rawOptions.map((option) =>
    typeof option === "object"
      ? option
      : {
          label: String(option),
          value: option,
        },
  );
}

function parseNumber(value: string, fallback: number) {
  if (value.trim() === "") return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function InspectorRow({ field }: { field: InspectorField }) {
  if (field.hidden) return null;

  if (field.kind === "group") {
    const visibleFields = field.fields.filter((item) => !item.hidden);
    if (visibleFields.length === 0) return null;

    return (
      <section className="rounded-md border bg-muted/15">
        <div className="border-b px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-0 text-muted-foreground">
            {field.label}
          </div>
          {field.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {field.description}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 p-3">
          {visibleFields.map((item) => (
            <InspectorRow key={`${field.label}-${item.label}`} field={item} />
          ))}
        </div>
      </section>
    );
  }

  if (field.kind === "button") {
    return (
      <Button
        type="button"
        size="sm"
        variant={field.variant ?? "outline"}
        disabled={field.disabled}
        onClick={() => void field.action()}
      >
        {field.label}
      </Button>
    );
  }

  if (field.kind === "readonly") {
    return (
      <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <div className="min-w-0 truncate rounded-md border bg-muted/30 px-2 py-1.5 font-mono">
          {field.value}
        </div>
      </div>
    );
  }

  if (field.kind === "boolean") {
    return (
      <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <Switch
          size="sm"
          checked={field.value}
          disabled={field.disabled}
          onCheckedChange={field.onChange}
        />
      </div>
    );
  }

  if (field.kind === "select") {
    const entries = optionEntries(field);
    const selected = String(field.value);
    const selectedEntry = entries.find((entry) => String(entry.value) === selected);

    return (
      <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <Select
          value={selected}
          disabled={field.disabled}
          onValueChange={(value) => {
            const entry = entries.find((item) => String(item.value) === value);
            field.onChange(entry?.value ?? value);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-full">
            <SelectValue placeholder={selectedEntry?.label ?? "Select"} />
          </SelectTrigger>
          <SelectContent>
            {entries.map((entry) => (
              <SelectItem key={`${field.label}-${entry.value}`} value={String(entry.value)}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "vector3") {
    const labels = ["x", "y", "z"] as const;
    return (
      <div className="grid gap-1.5 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {labels.map((axis, index) => (
            <Input
              key={axis}
              type="number"
              className="h-8 px-2 font-mono"
              aria-label={`${field.label} ${axis}`}
              value={field.value[index]}
              step={field.step ?? 0.01}
              disabled={field.disabled}
              onChange={(event) => {
                const next = [...field.value] as [number, number, number];
                next[index] = parseNumber(event.target.value, field.value[index]);
                field.onChange(next);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "range") {
    const [start, end] = field.value;
    const updateAt = (index: 0 | 1, value: string) => {
      const next: [number, number] = [start, end];
      next[index] = parseNumber(value, next[index]);
      field.onChange(next);
    };

    return (
      <div className="grid gap-1.5 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            type="number"
            className="h-8 px-2 font-mono"
            aria-label={`${field.label} start`}
            value={start}
            min={field.min}
            max={field.max}
            step={field.step ?? 0.1}
            disabled={field.disabled}
            onChange={(event) => updateAt(0, event.target.value)}
          />
          <Input
            type="number"
            className="h-8 px-2 font-mono"
            aria-label={`${field.label} end`}
            value={end}
            min={field.min}
            max={field.max}
            step={field.step ?? 0.1}
            disabled={field.disabled}
            onChange={(event) => updateAt(1, event.target.value)}
          />
        </div>
      </div>
    );
  }

  if (field.kind === "color") {
    return (
      <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3 text-xs">
        <Label className="text-muted-foreground">{field.label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-12 shrink-0 p-1"
            value={field.value}
            disabled={field.disabled}
            onChange={(event) => field.onChange(event.target.value)}
          />
          <Input
            className="h-8 px-2 font-mono"
            value={field.value}
            disabled={field.disabled}
            onChange={(event) => field.onChange(event.target.value)}
          />
        </div>
      </div>
    );
  }

  if (field.kind === "number") {
    const hasSlider =
      typeof field.min === "number" && typeof field.max === "number";

    return (
      <div className="grid gap-1.5 text-xs">
        <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3">
          <Label className="text-muted-foreground">{field.label}</Label>
          <Input
            type="number"
            className="h-8 px-2 font-mono"
            value={field.value}
            min={field.min}
            max={field.max}
            step={field.step ?? 0.01}
            disabled={field.disabled}
            onChange={(event) =>
              field.onChange(parseNumber(event.target.value, field.value))
            }
          />
        </div>
        {hasSlider ? (
          <Slider
            className="px-1"
            value={[field.value]}
            min={field.min}
            max={field.max}
            step={field.step ?? 0.01}
            disabled={field.disabled}
            onValueChange={([value]) => {
              if (typeof value === "number") field.onChange(value);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(7rem,0.75fr)_minmax(0,1fr)] items-center gap-3 text-xs">
      <Label className="text-muted-foreground">{field.label}</Label>
      <Input
        className="h-8 px-2"
        value={field.value}
        disabled={field.disabled}
        onChange={(event) => field.onChange(event.target.value)}
      />
    </div>
  );
}

export function InspectorPanel({
  fields,
  className,
  empty = "No editable properties.",
}: {
  fields: InspectorField[];
  className?: string;
  empty?: string;
}) {
  const visibleFields = fields.filter((field) => !field.hidden);

  if (visibleFields.length === 0) {
    return (
      <div className={cn("p-3 text-sm text-muted-foreground", className)}>
        {empty}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2 p-3", className)}>
      {visibleFields.map((field) => (
        <InspectorRow key={field.label} field={field} />
      ))}
    </div>
  );
}
