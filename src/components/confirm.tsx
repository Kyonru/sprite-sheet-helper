import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type InputOptions<TSchema extends z.ZodTypeAny = z.ZodString> = {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  schema?: TSchema;
};

type ConfirmOptions<TSchema extends z.ZodTypeAny = z.ZodString> = {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  showCancel?: boolean;

  input?: InputOptions<TSchema>;

  onConfirm?: (value: z.infer<TSchema> | undefined) => void | Promise<void>;
  onCancel?: () => void;
};

type ConfirmState = Omit<ConfirmOptions<z.ZodTypeAny>, "onConfirm"> & {
  title: string;
  open: boolean;
  onConfirm?: (value: unknown) => void | Promise<void>;
};

type Listener = (state: ConfirmState) => void;
let _listener: Listener | null = null;

function dispatch(state: ConfirmState) {
  _listener?.(state);
}

export function confirm<TSchema extends z.ZodTypeAny = z.ZodString>(
  title: string,
  opts: ConfirmOptions<TSchema> = {},
) {
  dispatch({
    title,
    open: true,
    showCancel: true,
    ...opts,
    onConfirm: opts.onConfirm as (value: unknown) => void | Promise<void>,
  });
}

confirm.delete = (name: string, opts: Omit<ConfirmOptions, "variant"> = {}) =>
  confirm(`Delete "${name}"?`, {
    description: "This action cannot be undone.",
    confirmLabel: "Delete",
    variant: "danger",
    showCancel: true,
    ...opts,
  });

confirm.warn = (title: string, opts: ConfirmOptions = {}) =>
  confirm(title, { variant: "warning", showCancel: true, ...opts });

confirm.withInput = <TSchema extends z.ZodTypeAny = z.ZodString>(
  title: string,
  opts: ConfirmOptions<TSchema> & { input: InputOptions<TSchema> },
) => confirm(title, opts);

export function ConfirmProvider() {
  const [state, setState] = useState<ConfirmState>({
    title: "",
    open: false,
    showCancel: true,
  });
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    _listener = (next) => {
      setState(next);
      setInputValue(next.input?.defaultValue ?? "");
      setInputError(null);
      setLoading(false);
    };
    return () => {
      _listener = null;
    };
  }, []);

  useEffect(() => {
    if (state.open && state.input) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [state.open, state.input]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    setLoading(false);
    setInputError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    let resolvedValue: unknown = undefined;

    if (state.input) {
      const schema = state.input.schema;
      if (schema) {
        const result = schema.safeParse(inputValue);
        if (!result.success) {
          setInputError(result.error.issues[0]?.message ?? "Invalid value");
          return; // keep dialog open
        }
        resolvedValue = result.data;
      } else {
        resolvedValue = inputValue;
      }
    }

    if (state.onConfirm) {
      setLoading(true);
      try {
        await state.onConfirm(resolvedValue);
      } finally {
        close();
      }
    } else {
      close();
    }
  }, [state, inputValue, close]);

  const handleCancel = useCallback(() => {
    if (loading) return;
    state.onCancel?.();
    close();
  }, [state, loading, close]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      if (inputError) setInputError(null);
    },
    [inputError],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleConfirm();
    },
    [handleConfirm],
  );

  const variantStyle = useMemo<{
    style: "default" | "destructive";
    color: string;
  }>(() => {
    switch (state.variant) {
      case "danger":
        return { style: "destructive", color: "bg-destructive" };
      case "warning":
        return { style: "destructive", color: "bg-chart-5" };
      default:
        return { style: "default", color: "bg-primary" };
    }
  }, [state.variant]);

  if (!state.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-999 backdrop-blur-xs">
      <AlertDialog open={true}>
        <AlertDialogContent className="z-1000">
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && (
              <AlertDialogDescription>
                {state.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {state.input && (
            <div className="flex flex-col gap-1.5 py-1">
              {state.input.label && (
                <Label htmlFor="confirm-input" className="text-sm">
                  {state.input.label}
                </Label>
              )}
              <Input
                ref={inputRef}
                id="confirm-input"
                value={inputValue}
                placeholder={state.input.placeholder}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                disabled={loading}
                aria-invalid={!!inputError}
                aria-describedby={
                  inputError ? "confirm-input-error" : undefined
                }
                className={cn(
                  inputError &&
                    "border-destructive focus-visible:ring-destructive",
                )}
              />
              {inputError && (
                <p
                  id="confirm-input-error"
                  className="text-xs text-destructive"
                >
                  {inputError}
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            {state.showCancel && (
              <AlertDialogCancel onClick={handleCancel} disabled={loading}>
                {state.cancelLabel || "Cancel"}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              className={cn([
                buttonVariants({ variant: variantStyle.style }),
                variantStyle.color,
              ])}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? "Loading…" : state.confirmLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>,
    document.body,
  );
}
