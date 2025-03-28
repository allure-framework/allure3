import type { ChartOptions } from "./types.js";

export type DashboardsOptions = {
  singleFile?: boolean;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
};

export type DashboardsPluginOptions = DashboardsOptions;
