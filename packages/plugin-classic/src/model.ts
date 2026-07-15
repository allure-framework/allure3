import type { TestResult, TestStatus } from "@allurereport/core-api";

export type ClassicOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  reportLanguage?: string;
  /**
   * When false, omit Google Analytics from the report HTML.
   * Also disabled when `ALLURE_NO_ANALYTICS=true` (Allure 2 parity).
   * @default true
   */
  analyticsEnable?: boolean;
  groupBy?: string[];
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
  filter?: (tr: TestResult) => boolean;
};

export type TemplateManifest = Record<string, string>;

export type ClassicPluginOptions = ClassicOptions;

export interface ClassicCategory {
  name: string;
  description?: string;
  descriptionHtml?: string;
  messageRegex?: string;
  traceRegex?: string;
  matchedStatuses?: TestStatus[];
  flaky?: boolean;
}
