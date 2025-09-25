import type { DefaultLabelsConfig, EnvironmentsConfig, ReportVariables } from "@allurereport/core-api";
import type { PluginDescriptor } from "./plugin.js";
import type { QualityGateConfig } from "./qualityGate.js";

export interface Config {
  name?: string;
  output?: string;
  historyPath?: string;
  knownIssuesPath?: string;
  defaultLabels?: DefaultLabelsConfig;
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
    url?: string;
    project?: string;
    accessToken?: string;
  };
  allureTestOps?: {
    url?: string;
    project: string;
    token: string;
  }
}

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
