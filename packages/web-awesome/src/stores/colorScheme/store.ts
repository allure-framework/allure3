import { effect, signal } from "@preact/signals";

import { COLOR_SCHEMES, STORAGE_KEY } from "./constants";
import type { ColorScheme } from "./types";

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
