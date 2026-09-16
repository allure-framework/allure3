import { themeStore } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";

import { STORAGE_KEY, THEME_FAMILIES } from "./constants";
import type { ColorScheme, ThemeFamily } from "./types";

const restore = (): ThemeFamily => {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeFamily | null;
  const valid = THEME_FAMILIES.map((f) => f.key);
  return stored && valid.includes(stored) ? stored : "allure";
};

export const selectedFamily = signal<ThemeFamily>(restore());

export const colorScheme = computed<ColorScheme>(() => {
  const family = THEME_FAMILIES.find((f) => f.key === selectedFamily.value);
  if (!family) return "default";
  return themeStore.value.current === "dark" ? family.dark : family.light;
});

effect(() => {
  const scheme = colorScheme.value;
  if (scheme === "default") {
    document.documentElement.removeAttribute("data-color-scheme");
  } else {
    document.documentElement.setAttribute("data-color-scheme", scheme);
  }
});

effect(() => {
  localStorage.setItem(STORAGE_KEY, selectedFamily.value);
});

export const setThemeFamily = (family: ThemeFamily) => {
  selectedFamily.value = family;
};
