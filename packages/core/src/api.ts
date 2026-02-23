import type {
  DefaultLabelsConfig,
  EnvironmentsConfig,
  KnownTestFailure,
  ReportVariables,
} from "@allurereport/core-api";
import type { Plugin, QualityGateConfig, ReportFiles } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}

export interface FullConfig {
  name: string;
  output: string;
  open: boolean;
  port: string | undefined;
  historyPath?: string;
  historyLimit?: number;
  knownIssuesPath: string;
  /**
   * You can specify default labels for tests which don't have them at all
   * Could be useful if you want to highlight specific group of tests, e.g. when it's necessary to set the labels manually
   * @example
   * ```json
   * {
   *   "defaultLabels": {
   *     "severity": "unspecified severity, set it manually",
   *     "tag": ["foo", "bar"]
   *   }
   * }
   * ```
   */
  defaultLabels?: DefaultLabelsConfig;
  /**
   * Signals that the report's plugins shouldn't be executed, but test results should be archived
   * Archived test results can be restored later
   */
  dump?: string;
  /**
   * Environment which will be assigned to all tests
   * Has higher priority than matched environment from the environments config field
   */
  environment?: string;
  environments?: EnvironmentsConfig;
  variables?: ReportVariables;
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  appendHistory?: boolean;
  known?: KnownTestFailure[];
  realTime?: any;
  qualityGate?: QualityGateConfig;
  allureService?: {
    accessToken?: string;
  };
}
