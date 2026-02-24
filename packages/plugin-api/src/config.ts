import type { DefaultLabelsConfig, EnvironmentsConfig, ReportVariables } from "@allurereport/core-api";
import type { PluginDescriptor } from "./plugin.js";
import type { QualityGateConfig } from "./qualityGate.js";

export interface Config {
  name?: string;
  output?: string;
  open?: boolean;
  port?: string;
  historyPath?: string;
  historyLimit?: number;
  knownIssuesPath?: string;
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
  /**
   * You can specify plugins by their package name:
   * @example
   * ```json
   * {
   *   "plugins": {
   *     "@allurereport/classic": {
   *       options: {}
   *     }
   *   }
   * }
   * ```
   * Or use key as a plugin id and specify package name in the import field:
   * @example
   * ```json
   * {
   *   "plugins": {
   *     "my-custom-allure-id": {
   *       import: "@allurereport/classic",
   *       options: {}
   *     }
   *   }
   * }
   * ```
   * Both examples above will do the same thing
   */
  plugins?: Record<string, PluginDescriptor>;
  appendHistory?: boolean;
  qualityGate?: QualityGateConfig;
  allureService?: {
    accessToken?: string;
  };
}

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
