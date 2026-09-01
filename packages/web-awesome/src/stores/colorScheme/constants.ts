import type { ThemeFamilyOption } from "./types";

export const STORAGE_KEY = "colorScheme";

export const THEME_FAMILIES: ThemeFamilyOption[] = [
  { key: "allure", label: "Allure", preview: "", light: "default", dark: "default" },
  {
    key: "allure-deuteranopia",
    label: "Allure · Deuteranopia",
    preview: "",
    light: "allure-deuteranopia-light",
    dark: "allure-deuteranopia-dark",
  },
  {
    key: "allure-tritanopia",
    label: "Allure · Tritanopia",
    preview: "",
    light: "allure-tritanopia-light",
    dark: "allure-tritanopia-dark",
  },
  {
    key: "allure-high-contrast",
    label: "Allure · High Contrast",
    preview: "",
    light: "allure-high-contrast-light",
    dark: "allure-high-contrast-dark",
  },
  { key: "github", label: "GitHub", preview: "#0d1117", light: "github-light", dark: "github-dark" },
  { key: "one", label: "One", preview: "#282c34", light: "one-light", dark: "one-dark" },
  { key: "catppuccin", label: "Catppuccin", preview: "#1e1e2e", light: "catppuccin-latte", dark: "catppuccin" },
  { key: "solarized", label: "Solarized", preview: "#002b36", light: "solarized-light", dark: "solarized-dark" },
  { key: "tokyo-night", label: "Tokyo Night", preview: "#1a1b2e", light: "tokyo-night", dark: "tokyo-night" },
  { key: "monokai", label: "Monokai", preview: "#272822", light: "monokai", dark: "monokai" },
  { key: "dracula", label: "Dracula", preview: "#282a36", light: "dracula", dark: "dracula" },
  { key: "nord", label: "Nord", preview: "#2e3440", light: "nord", dark: "nord" },
];
