import type { EnvironmentsConfig } from "@allurereport/core-api";

export type AwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  layout?: "base" | "split";
  excludeSkippedFromChart?: boolean;
  environments?: Record<string, EnvironmentsConfig>;
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
};

export type TemplateManifest = Record<string, string>;

export type AwesomePluginOptions = AwesomeOptions;
