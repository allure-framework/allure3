import { effect, signal } from "@preact/signals";

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

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { key: "default", label: "Default", preview: "#1a1b2e" },
  { key: "tokyo-night", label: "Tokyo Night", preview: "#1a1b2e" },
  { key: "monokai", label: "Monokai", preview: "#272822" },
  { key: "dracula", label: "Dracula", preview: "#282a36" },
  { key: "one-dark", label: "One Dark", preview: "#282c34" },
  { key: "catppuccin", label: "Catppuccin Mocha", preview: "#1e1e2e" },
  { key: "nord", label: "Nord", preview: "#2e3440" },
  { key: "solarized-dark", label: "Solarized Dark", preview: "#002b36" },
  { key: "github-dark", label: "GitHub Dark", preview: "#0d1117" },
];

const STORAGE_KEY = "colorScheme";

const restore = (): ColorScheme => {
  const stored = localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
  const valid = COLOR_SCHEMES.map((s) => s.key);
  return stored && valid.includes(stored) ? stored : "default";
};

export const colorScheme = signal<ColorScheme>(restore());

effect(() => {
  const scheme = colorScheme.value;
  if (scheme === "default") {
    document.documentElement.removeAttribute("data-color-scheme");
  } else {
    document.documentElement.setAttribute("data-color-scheme", scheme);
  }
  localStorage.setItem(STORAGE_KEY, scheme);
});

export const setColorScheme = (scheme: ColorScheme) => {
  colorScheme.value = scheme;
};
