import type { LevaCustomTheme } from "leva/dist/declarations/src/styles";

export const MINIMAL_LEVA_THEME: LevaCustomTheme = {
  colors: {
    elevation1: "var(--card)",
    elevation2: "var(--muted)",
    elevation3: "var(--border)",

    accent1: "var(--chart-3)",
    accent2: "var(--primary)",
    accent3: "var(--chart-2)",

    highlight1: "var(--card-foreground)",
    highlight2: "var(--muted-foreground)",
    highlight3: "var(--primary-foreground)",

    vivid1: "var(--destructive)",

    folderTextColor: "var(--muted-foreground)",
  },
  radii: {
    xs: "2px",
    sm: "3px",
    lg: "10px",
  },
  space: {
    sm: "6px",
    md: "10px",
    rowGap: "7px",
    colGap: "7px",
  },
  fontSizes: {
    root: "14px",
    // label: "12px",
    toolTip: "11px",
  },
};

export const LEVA_THEME: LevaCustomTheme = {
  ...MINIMAL_LEVA_THEME,
  sizes: {
    rootWidth: "100%",
    controlWidth: "70%",
    scrubberWidth: "8px",
    scrubberHeight: "16px",
    rowHeight: "24px",
    // folderHeight: "20px",
    checkboxSize: "16px",
    joystickWidth: "100px",
    joystickHeight: "100px",
    colorPickerWidth: "160px",
    colorPickerHeight: "100px",
    monitorHeight: "60px",
    titleBarHeight: "39px",
    numberInputMinWidth: "40px",
  },
};

export const FONTS = [
  "arial",
  "helvetica",
  "times new roman",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "courier new",
  "lucida console",
  "impact",
  "comic sans ms",
  "palatino linotype",
  "segoe ui",
  "candara",
  "geneva",
  "optima",
  "monaco",
  "brush script mt",
  "consolas",
  "franklin gothic medium",
  // Generic font families
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
] as const;
