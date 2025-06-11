export const LEVA_THEME = {
  colors: {
    elevation1: "var(--card)",
    elevation2: "var(--muted)",
    elevation3: "var(--border)",

    accent1: "var(--primary-foreground)",
    accent2: "var(--accent-foreground)",
    accent3: "var(--ring)",

    highlight1: "var(--card-foreground)",
    highlight2: "var(--muted-foreground)",
    highlight3: "var(--chart-3)",

    vivid1: "var(--destructive)",
  },
  radii: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "var(--radius)",
  },
  space: {
    rowGap: "0.5rem",
    colGap: "0.5rem",
    controlHeight: "2rem",
  },
  fontSizes: {
    root: "14px",
    label: "12px",
    toolTip: "11px",
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