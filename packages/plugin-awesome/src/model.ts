import type { ChartOptions } from "@allurereport/charts-api";
import type { CiDescriptor, EnvironmentsConfig, TestResult } from "@allurereport/core-api";
import type { StepTreeExpansion } from "@allurereport/plugin-api";

export type IdeaLinksOptions = {
  /** Port of the IDEA built-in server. Default: 63342 */
  port?: number;
  /** Extension of the test source file, with or without a leading dot. Default: "java" */
  fileExtension?: string;
  /** Path of the sources root relative to the project root, e.g. "src/test/java". Default: none */
  sourceRoot?: string;
};

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
  stepTreeExpansion?: StepTreeExpansion;
  defaultSortBy?: string;
  /**
   * Adds an "Open in IDEA" link to every test that has a `testClass` label.
   * Uses the IntelliJ IDEA built-in server (`http://localhost:<port>/api/file`). Disabled by default.
   */
  ideaLinks?: boolean | IdeaLinksOptions;
};

export type TemplateManifest = Record<string, string>;

export type AwesomePluginOptions = AwesomeOptions;
