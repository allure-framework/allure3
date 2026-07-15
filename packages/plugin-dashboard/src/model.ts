import type { ChartOptions } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";

export type DashboardOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: string;
  /**
   * When false, omit Google Analytics from the report HTML.
   * Also disabled when `ALLURE_NO_ANALYTICS=true` (Allure 2 parity).
   * @default true
   */
  analyticsEnable?: boolean;
  layout?: ChartOptions[];
  filter?: (testResult: TestResult) => boolean;
};

export type DashboardPluginOptions = DashboardOptions;

export type TemplateManifest = Record<string, string>;
