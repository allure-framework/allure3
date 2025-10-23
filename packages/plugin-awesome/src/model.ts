import type { CiDescriptor, EnvironmentsConfig, TestResult } from "@allurereport/core-api";
import type { ChartOptions } from "@allurereport/charts-api";

export type AwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  layout?: "base" | "split";
  environments?: Record<string, EnvironmentsConfig>;
  ci?: CiDescriptor;
  filter?: (testResult: TestResult) => boolean;
  charts?: ChartOptions[];
  sections?: string[];
  defaultSection?: string;
  publish?: boolean;
};

export type TemplateManifest = Record<string, string>;

export type AwesomePluginOptions = AwesomeOptions;
