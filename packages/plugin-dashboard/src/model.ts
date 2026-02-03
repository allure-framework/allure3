import type { ChartOptions } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";

export type DashboardOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: string;
  layout?: ChartOptions[];
  filter?: (testResult: TestResult) => boolean;
};

export type DashboardPluginOptions = DashboardOptions;

export type TemplateManifest = Record<string, string>;
