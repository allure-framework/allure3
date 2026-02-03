import type { ChartOptions } from "@allurereport/charts-api";
import type { CiDescriptor, EnvironmentsConfig, TestResult } from "@allurereport/core-api";

export type AwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  reportLanguage?: string;
  groupBy?: string[];
  layout?: "base" | "split";
  environments?: Record<string, EnvironmentsConfig>;
  ci?: CiDescriptor;
  filter?: (testResult: TestResult) => boolean;
  charts?: ChartOptions[];
  timeline?: {
    minDuration?: number;
  };
  sections?: string[];
  defaultSection?: string;
  publish?: boolean;
  appendTitlePath?: boolean;
};

export type TemplateManifest = Record<string, string>;

export type AwesomePluginOptions = AwesomeOptions;
