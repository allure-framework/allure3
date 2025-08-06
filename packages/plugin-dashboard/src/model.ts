import type { BaseTrendSliceMetadata, ChartOptions, TestResult, TrendSlice, TrendSliceMetadata } from "@allurereport/core-api";

export interface StatusMetadata extends BaseTrendSliceMetadata {}
export type StatusTrendSliceMetadata = TrendSliceMetadata<StatusMetadata>;
export type StatusTrendSlice = TrendSlice<StatusTrendSliceMetadata>;

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
