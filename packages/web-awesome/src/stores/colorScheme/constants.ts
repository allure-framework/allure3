import type { ColorSchemeOption } from "./types";

export const STORAGE_KEY = "colorScheme";

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { key: "default", label: "Allure", preview: "" },
  { key: "tokyo-night", label: "Tokyo Night", preview: "#1a1b2e" },
  { key: "monokai", label: "Monokai", preview: "#272822" },
  { key: "dracula", label: "Dracula", preview: "#282a36" },
  { key: "one-dark", label: "One Dark", preview: "#282c34" },
  { key: "catppuccin", label: "Catppuccin Mocha", preview: "#1e1e2e" },
  { key: "nord", label: "Nord", preview: "#2e3440" },
  { key: "solarized-dark", label: "Solarized Dark", preview: "#002b36" },
  { key: "github-dark", label: "GitHub Dark", preview: "#0d1117" },
  { key: "github-light", label: "GitHub Light", preview: "#f6f8fa" },
  { key: "solarized-light", label: "Solarized Light", preview: "#fdf6e3" },
  { key: "one-light", label: "One Light", preview: "#fafafa" },
  { key: "catppuccin-latte", label: "Catppuccin Latte", preview: "#eff1f5" },
];
