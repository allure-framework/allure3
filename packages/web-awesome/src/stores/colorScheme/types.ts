export type ColorScheme =
  | "default"
  | "tokyo-night"
  | "monokai"
  | "dracula"
  | "one-dark"
  | "catppuccin"
  | "nord"
  | "solarized-dark"
  | "github-dark";

export interface ColorSchemeOption {
  key: ColorScheme;
  label: string;
  preview: string;
}
