import type { TestStatus } from "@allurereport/core-api";

export type AllureAwesomeOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  groupBy?: string[];
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
};

export type TemplateManifest = Record<string, string>;

export type AllureAwesomePluginOptions = AllureAwesomeOptions;

export interface AllureAwesomeCategory {
  name: string;
  description?: string;
  descriptionHtml?: string;
  messageRegex?: string;
  traceRegex?: string;
  matchedStatuses?: TestStatus[];
  flaky?: boolean;
}
