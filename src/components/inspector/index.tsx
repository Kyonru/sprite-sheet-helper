import * as React from "react";
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
type InspectorButtonTone = "primary" | "secondary" | "danger";

type InspectorButtonAction = {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  tone?: InspectorButtonTone;
};

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
      tone?: InspectorButtonTone;
      className?: string;
      fullWidth?: boolean;
      hidden?: boolean;
    }
  | {
      kind: "button-row";
      label?: string;
      actions: InspectorButtonAction[];
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

function isDraftNumber(value: string) {
  return value === "" || value === "-" || value === "." || value === "-.";
}

function NumericInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [focused, value]);

  return (
    <Input
      {...props}
      type="number"
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        if (isDraftNumber(draft) || !Number.isFinite(Number(draft))) {
          setDraft(String(value));
        }
        onBlur?.(event);
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);

        if (isDraftNumber(nextDraft)) return;

        const nextValue = Number(nextDraft);
        if (Number.isFinite(nextValue)) {
          onValueChange(nextValue);
        }
      }}
    />
  );
}

function buttonVariantForTone(
  tone: InspectorButtonTone | undefined,
  variant: React.ComponentProps<typeof Button>["variant"] | undefined,
) {
  if (variant) return variant;
  if (tone === "primary") return "default";
  if (tone === "danger") return "outline";
  return "secondary";
}

function buttonClassForTone(
  tone: InspectorButtonTone | undefined,
  fullWidth?: boolean,
  className?: string,
) {
  return cn(
    "h-7 px-2.5 text-xs",
    fullWidth ? "w-full" : "justify-self-start",
    tone === "danger" &&
      "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive",
    tone === "secondary" &&
      "border-transparent bg-muted/45 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
    className,
  );
}

function formatReadonlyValue(value: React.ReactNode) {
  if (typeof value !== "string") return value;

  const secondsMatch = value.match(/^(-?\d+(?:\.\d+)?)\s*seconds?$/i);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    if (Number.isFinite(seconds)) return `${seconds.toFixed(2)}s`;
  }

  const numericMatch = value.match(/^-?\d+\.\d{4,}$/);
  if (numericMatch) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric.toFixed(3);
  }

  return value;
}

function InspectorRow({ field }: { field: InspectorField }) {
  if (field.hidden) return null;

  if (field.kind === "group") {
    const visibleFields = field.fields.filter((item) => !item.hidden);
    if (visibleFields.length === 0) return null;

    return (
      <section className="grid gap-2 border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {field.label}
          </div>
          {field.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {field.description}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
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
        variant={buttonVariantForTone(field.tone, field.variant)}
        disabled={field.disabled}
        className={buttonClassForTone(field.tone, field.fullWidth, field.className)}
        onClick={() => void field.action()}
      >
        {field.label}
      </Button>
    );
  }

  if (field.kind === "button-row") {
    return (
      <div className="grid gap-1.5">
        {field.label ? (
          <Label className="text-xs text-muted-foreground">{field.label}</Label>
        ) : null}
        <div
          className={cn(
            "grid gap-1.5",
            field.actions.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {field.actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant={buttonVariantForTone(action.tone, action.variant)}
              disabled={action.disabled}
              className={buttonClassForTone(action.tone, true)}
              onClick={() => void action.action()}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (field.kind === "readonly") {
    return (
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-center gap-2 text-xs">
        <Label className="text-muted-foreground/90">{field.label}</Label>
        <div className="min-w-0 truncate rounded-md bg-muted/25 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
          {formatReadonlyValue(field.value)}
        </div>
      </div>
    );
  }

  if (field.kind === "boolean") {
    return (
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-center gap-2 py-0.5 text-xs">
        <Label className="text-muted-foreground/90">{field.label}</Label>
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
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-center gap-2 text-xs">
        <Label className="text-muted-foreground/90">{field.label}</Label>
        <Select
          value={selected}
          disabled={field.disabled}
          onValueChange={(value) => {
            const entry = entries.find((item) => String(item.value) === value);
            field.onChange(entry?.value ?? value);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-full bg-muted/20">
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
        <Label className="text-muted-foreground/90">{field.label}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {labels.map((axis, index) => (
            <NumericInput
              key={axis}
              className="h-8 bg-muted/20 px-2 font-mono"
              aria-label={`${field.label} ${axis}`}
              value={field.value[index]}
              step={field.step ?? 0.01}
              disabled={field.disabled}
              onValueChange={(value) => {
                const next = [...field.value] as [number, number, number];
                next[index] = value;
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
    const min = field.min ?? 0;
    const max = field.max ?? Math.max(start, end, 1);
    const updateAt = (index: 0 | 1, value: string) => {
      const next: [number, number] = [start, end];
      next[index] = parseNumber(value, next[index]);
      field.onChange(next);
    };

    return (
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-start gap-2 text-xs">
        <Label className="pt-2 text-muted-foreground/90">{field.label}</Label>
        <div className="grid gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <NumericInput
              className="h-8 bg-muted/20 px-2 font-mono"
              aria-label={`${field.label} start`}
              value={start}
              min={field.min}
              max={field.max}
              step={field.step ?? 0.1}
              disabled={field.disabled}
              onValueChange={(value) => updateAt(0, String(value))}
            />
            <NumericInput
              className="h-8 bg-muted/20 px-2 font-mono"
              aria-label={`${field.label} end`}
              value={end}
              min={field.min}
              max={field.max}
              step={field.step ?? 0.1}
              disabled={field.disabled}
              onValueChange={(value) => updateAt(1, String(value))}
            />
          </div>
          <Slider
            className="px-1 py-1"
            value={[start, end]}
            min={min}
            max={max}
            step={field.step ?? 0.1}
            disabled={field.disabled}
            onValueChange={([nextStart, nextEnd]) => {
              field.onChange([
                typeof nextStart === "number" ? nextStart : start,
                typeof nextEnd === "number" ? nextEnd : end,
              ]);
            }}
          />
        </div>
      </div>
    );
  }

  if (field.kind === "color") {
    return (
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-center gap-2 text-xs">
        <Label className="text-muted-foreground/90">{field.label}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-8 w-12 shrink-0 bg-muted/20 p-1"
            value={field.value}
            disabled={field.disabled}
            onChange={(event) => field.onChange(event.target.value)}
          />
          <Input
            className="h-8 bg-muted/20 px-2 font-mono"
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
      <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-start gap-2 text-xs">
        <Label className="pt-2 text-muted-foreground/90">{field.label}</Label>
        <div className="grid gap-1.5">
          <NumericInput
            className="h-8 bg-muted/20 px-2 font-mono"
            value={field.value}
            min={field.min}
            max={field.max}
            step={field.step ?? 0.01}
            disabled={field.disabled}
            onValueChange={field.onChange}
          />
          {hasSlider ? (
            <Slider
              className="px-1 py-1"
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1fr)] items-center gap-2 text-xs">
      <Label className="text-muted-foreground/90">{field.label}</Label>
      <Input
        className="h-8 bg-muted/20 px-2"
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
    <div className={cn("grid gap-3 p-3", className)}>
      {visibleFields.map((field) => (
        <InspectorRow key={field.label} field={field} />
      ))}
    </div>
  );
}
