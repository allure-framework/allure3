export type ThemeFamily =
  | "allure"
  | "github"
  | "one"
  | "catppuccin"
  | "solarized"
  | "tokyo-night"
  | "monokai"
  | "dracula"
  | "nord";

export type ColorScheme =
  | "default"
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
  | "nord";

export interface ThemeFamilyOption {
  key: ThemeFamily;
  label: string;
  preview: string;
  light: ColorScheme;
  dark: ColorScheme;
}
