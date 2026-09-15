export type ThemeFamily =
  | "allure"
  | "allure-deuteranopia"
  | "allure-tritanopia"
  | "allure-high-contrast"
  | "github"
  | "one"
  | "catppuccin"
  | "solarized"
  | "tokyo-night"
  | "monokai"
  | "dracula"
  | "nord"
  | "darcula"
  | "vscode"
  | "gruvbox";

export type ColorScheme =
  | "default"
  | "allure-deuteranopia-light"
  | "allure-deuteranopia-dark"
  | "allure-tritanopia-light"
  | "allure-tritanopia-dark"
  | "allure-high-contrast-light"
  | "allure-high-contrast-dark"
  | "github-light"
  | "github-dark"
  | "one-light"
  | "one-dark"
  | "catppuccin-latte"
  | "catppuccin"
  | "solarized-light"
  | "solarized-dark"
  | "tokyo-night"
  | "monokai"
  | "dracula"
  | "nord"
  | "darcula"
  | "intellij-light"
  | "vscode-dark"
  | "vscode-light"
  | "gruvbox-dark"
  | "gruvbox-light";

export interface ThemeFamilyOption {
  key: ThemeFamily;
  label: string;
  light: ColorScheme;
  dark: ColorScheme;
}
