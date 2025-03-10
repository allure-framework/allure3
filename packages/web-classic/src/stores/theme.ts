import { getReportOptions } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { AwesomeReportOptions } from "../../types.js";

type Theme = "light" | "dark";

const { theme } = getReportOptions<AwesomeReportOptions>() ?? {};

export const themeStore = signal<Theme>("light");

export const setTheme = (newTheme: Theme): void => {
  themeStore.value = newTheme;
  document.documentElement.setAttribute("data-theme", newTheme);
  window.localStorage.setItem("theme", newTheme);
};

export const toggleTheme = () => {
  setTheme(themeStore.value === "light" ? "dark" : "light");
};

export const getTheme = () => {
  const themeFromLS = (window.localStorage.getItem("theme") as Theme | null) || (theme as Theme);

  if (themeFromLS) {
    setTheme(themeFromLS);
    return;
  }

  const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = prefersDarkScheme ? "dark" : "light";

  setTheme(initialTheme);
};
