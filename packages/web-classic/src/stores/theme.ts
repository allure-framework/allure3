import { getReportOptions } from "@allurereport/web-commons";
import type { Theme } from "@allurereport/web-components";
import { signal } from "@preact/signals";
import type { ClassicReportOptions } from "../../types.js";

export const themeStore = signal<Theme>("auto");

export const setTheme = (mode: "light" | "dark" | "auto") => {
  themeStore.value = mode;

  try {
    window.localStorage.setItem("theme", mode);
  } catch {}

  document.documentElement.setAttribute("data-theme", mode);
};

export const toggleTheme = () => {
  const order = ["light", "dark", "auto"];
  const current = themeStore.value;
  const next = order[(order.indexOf(current) + 1) % order.length] as Theme;
  setTheme(next);
};

export const getTheme = () => {
  const { theme } = getReportOptions<ClassicReportOptions>() ?? {};
  const themeFromLS = (window.localStorage.getItem("theme") as Theme | null) || (theme as Theme);

  setTheme(themeFromLS);
};
