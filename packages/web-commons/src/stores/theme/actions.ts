import { effect } from "@preact/signals";
import { SELECTED_THEMES, THEME_DARK, THEME_LIGHT } from "./constants.js";
import { currentTheme, preferredTheme, userTheme } from "./store.js";
import type { UserTheme } from "./types.js";
import { getPrefersColorSchemeMQ } from "./utils.js";

export const initThemeStore = () => {
  if (typeof window === "undefined") {
    return;
  }

  const disposeThemeSetter = effect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme.value);
  });

  const preffersMediaQuery = getPrefersColorSchemeMQ();

  const handleMediaQueryChange = (event: MediaQueryListEvent) => {
    if (event.matches) {
      preferredTheme.value = THEME_DARK;
    } else {
      preferredTheme.value = THEME_LIGHT;
    }
  };

  preffersMediaQuery.addEventListener("change", handleMediaQueryChange);

  return {
    dispose: () => {
      preffersMediaQuery.removeEventListener("change", handleMediaQueryChange);
      disposeThemeSetter();
    },
  };
};

export const setUserTheme = (theme: UserTheme) => {
  userTheme.value = theme;
};

export const toggleUserTheme = () => {
  const current = userTheme.peek();

  const next = SELECTED_THEMES[(SELECTED_THEMES.indexOf(current) + 1) % SELECTED_THEMES.length];
  setUserTheme(next);
};
