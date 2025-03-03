import { type BaseConfig } from "@allurereport/core-api";
import type { PluginDescriptor } from "./plugin.js";

export interface Config {
  name?: BaseConfig["name"];
  output?: BaseConfig["output"];
  historyPath?: BaseConfig["historyPath"];
  knownIssuesPath?: BaseConfig["knownIssuesPath"];
  qualityGate?: BaseConfig["qualityGate"];
  defaultLabels?: BaseConfig["defaultLabels"];
  environments?: BaseConfig["environments"];
  variables?: BaseConfig["variables"];
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
}

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
