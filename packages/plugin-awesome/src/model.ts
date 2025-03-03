import type { TestResult } from "@allurereport/core-api";

export type AwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  layout?: "base" | "split";
  environments?: Record<string, (tr: TestResult) => boolean>;
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
};

export type TemplateManifest = Record<string, string>;

export type AwesomePluginOptions = AwesomeOptions;
