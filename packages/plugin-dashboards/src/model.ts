import type { ChartOptions } from "./types.js";

export enum ChartType {
  STATUS = "status",
  SEVERITY = "severity",
};

export type DashboardsOptions = {
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
};

export type DashboardsPluginOptions = DashboardsOptions;

export type TemplateManifest = Record<string, string>;
