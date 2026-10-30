import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { IdeaLinksOptions } from "@allurereport/plugin-api";

export type { IdeaLinksOptions };

export type ClassicOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark" | "auto";
  reportLanguage?: string;
  groupBy?: string[];
  ci?: {
    type: "github" | "jenkins";
    url: string;
    name: string;
  };
  filter?: (tr: TestResult) => boolean;
  timeline?: {
    minDuration?: number;
  };
  /**
   * Adds an "Open in IDEA" link to every test that has a `testClass` label.
   * Uses the IntelliJ IDEA built-in server (`http://localhost:<port>/api/file`). Disabled by default.
   */
  ideaLinks?: boolean | IdeaLinksOptions;
};

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
