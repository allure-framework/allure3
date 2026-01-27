import { SELECTED_THEMES, THEME_AUTO } from "./constants.js";
import type { UserTheme } from "./types.js";

const nullMediaQueryList: MediaQueryList = {
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
  media: "",
  onchange: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => true,
};

export const getPrefersColorSchemeMQ = (): MediaQueryList => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return nullMediaQueryList;
  }

  return window.matchMedia("(prefers-color-scheme: dark)");
};

export const isAcceptedThemeValue = (value: unknown): value is UserTheme => {
  return SELECTED_THEMES.includes(value as UserTheme);
};

export const isAutoTheme = (theme: UserTheme): theme is "auto" => {
  return theme === THEME_AUTO;
};
