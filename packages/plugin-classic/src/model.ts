import type { TestResult, TestStatus } from "@allurereport/core-api";

export type IdeaLinksOptions = {
  /** Port of the IDEA built-in server. Default: 63342 */
  port?: number;
  /** Extension of the test source file, with or without a leading dot. Default: "java" */
  fileExtension?: string;
  /** Path of the sources root relative to the project root, e.g. "src/test/java". Default: none */
  sourceRoot?: string;
};

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
