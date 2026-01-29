import { computed, signal } from "@preact/signals-core";
import { getReportOptions } from "../../data.js";
import { persistSignal, restoreSignal } from "../persister/index.js";
import { STORAGE_KEY, THEME_AUTO, THEME_DARK, THEME_LIGHT } from "./constants.js";
import type { UITheme, UserTheme } from "./types.js";
import { getPrefersColorSchemeMQ, isAcceptedThemeValue, isAutoTheme } from "./utils.js";

const reportConfigTheme = getReportOptions<{ theme: UserTheme }>()?.theme as UserTheme | undefined;

const getInitialPreferredTheme = (): UITheme => {
  if (typeof window === "undefined") {
    return THEME_LIGHT;
  }

  if (getPrefersColorSchemeMQ().matches) {
    return THEME_DARK;
  }

  return THEME_LIGHT;
};

export const currentTheme = computed(() => {
  if (isAutoTheme(userTheme.value)) {
    return preferredTheme.value;
  }

  return userTheme.value;
});

export const userTheme = signal<UserTheme>(THEME_AUTO);
export const preferredTheme = signal<UITheme>(getInitialPreferredTheme());

restoreSignal({
  signal: userTheme,
  key: STORAGE_KEY,
  onRestore: (value) => {
    if (isAcceptedThemeValue(value)) {
      return value;
    }

    return reportConfigTheme ?? THEME_AUTO;
  },
});

persistSignal({
  signal: userTheme,
  key: STORAGE_KEY,
});

export const themeStore = computed(
  () =>
    ({
      current: currentTheme.value,
      selected: userTheme.value,
    }) as const,
);
