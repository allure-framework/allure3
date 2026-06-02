export type ColorScheme =
  | "default"
  | "tokyo-night"
  | "monokai"
  | "dracula"
  | "one-dark"
  | "catppuccin"
  | "nord"
  | "solarized-dark"
  | "github-dark"
  | "github-light"
  | "solarized-light"
  | "one-light"
  | "catppuccin-latte";

export interface ColorSchemeOption {
  key: ColorScheme;
  label: string;
  preview: string;
}
