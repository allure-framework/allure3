import { effect } from "@preact/signals-core";
import { SELECTED_THEMES, THEME_DARK, THEME_LIGHT } from "./constants.js";
import { currentTheme, preferredTheme, userTheme } from "./store.js";
import type { UserTheme } from "./types.js";
import { getPrefersColorSchemeMQ } from "./utils.js";

const initThemeStore = () => {
  if (typeof window === "undefined") {
    return;
  }

  effect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme.value);
  });

  const preffersMediaQuery = getPrefersColorSchemeMQ();

  preffersMediaQuery.addEventListener("change", (event: MediaQueryListEvent) => {
    if (event.matches) {
      preferredTheme.value = THEME_DARK;
    } else {
      preferredTheme.value = THEME_LIGHT;
    }
  });
};

export const setUserTheme = (theme: UserTheme) => {
  userTheme.value = theme;
};

export const toggleUserTheme = () => {
  const current = userTheme.peek();

  const next = SELECTED_THEMES[(SELECTED_THEMES.indexOf(current) + 1) % SELECTED_THEMES.length];
  setUserTheme(next);
};

initThemeStore();
