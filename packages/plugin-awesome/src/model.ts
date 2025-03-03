import type { TestResult } from "@allurereport/core-api";

export type AllureAwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  environments?: Record<string, (tr: TestResult) => boolean>;
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
};

export type TemplateManifest = Record<string, string>;

export type AllureAwesomePluginOptions = AllureAwesomeOptions;
