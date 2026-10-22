import type { ThemeFamilyOption } from "./types";

export const STORAGE_KEY = "colorScheme";

export const THEME_FAMILIES: ThemeFamilyOption[] = [
  { key: "allure", label: "Allure", light: "default", dark: "default" },
  {
    key: "allure-deuteranopia",
    label: "Allure · Deuteranopia",
    light: "allure-deuteranopia-light",
    dark: "allure-deuteranopia-dark",
  },
  {
    key: "allure-tritanopia",
    label: "Allure · Tritanopia",
    light: "allure-tritanopia-light",
    dark: "allure-tritanopia-dark",
  },
  {
    key: "allure-high-contrast",
    label: "Allure · High Contrast",
    light: "allure-high-contrast-light",
    dark: "allure-high-contrast-dark",
  },
  { key: "github", label: "GitHub", light: "github-light", dark: "github-dark" },
  { key: "one", label: "One", light: "one-light", dark: "one-dark" },
  { key: "catppuccin", label: "Catppuccin", light: "catppuccin-latte", dark: "catppuccin" },
  { key: "solarized", label: "Solarized", light: "solarized-light", dark: "solarized-dark" },
  { key: "tokyo-night", label: "Tokyo Night", light: "tokyo-night", dark: "tokyo-night" },
  { key: "monokai", label: "Monokai", light: "monokai", dark: "monokai" },
  { key: "dracula", label: "Dracula", light: "dracula", dark: "dracula" },
  { key: "nord", label: "Nord", light: "nord", dark: "nord" },
  { key: "darcula", label: "Darcula", light: "intellij-light", dark: "darcula" },
  { key: "vscode", label: "VS Code", light: "vscode-light", dark: "vscode-dark" },
  { key: "gruvbox", label: "Gruvbox", light: "gruvbox-light", dark: "gruvbox-dark" },
];
