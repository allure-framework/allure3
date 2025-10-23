import type { TestResult } from "@allurereport/core-api";
import type { ChartOptions } from "@allurereport/charts-api";

export type DashboardOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
  filter?: (testResult: TestResult) => boolean;
};

export type DashboardPluginOptions = DashboardOptions;

export type TemplateManifest = Record<string, string>;
