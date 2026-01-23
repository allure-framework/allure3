import type { UserTheme } from "./types.js";

export const THEME_AUTO = "auto";
export const THEME_LIGHT = "light";
export const THEME_DARK = "dark";
export const STORAGE_KEY = "theme";
export const SELECTED_THEMES: UserTheme[] = [THEME_LIGHT, THEME_DARK, THEME_AUTO];
