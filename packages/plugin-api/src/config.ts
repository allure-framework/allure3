import type { PluginDescriptor } from "./plugin.js";
import type { QualityGateConfig } from "./qualityGate.js";

export interface Config {
  name?: string;
  output?: string;
  historyPath?: string;
  knownIssuesPath?: string;
  qualityGate?: QualityGateConfig;
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
  /**
   * You can specify default labels for tests which don't have them at all
   * Could be useful if you want to highlight specific group of tests, e.g. when it's necessary to set the labels manually
   * @example
   * ```json
   * {
   *   "defaultLabels": {
   *     "severity": "unspecified severity, set it manually",
   *   }
   * }
   * ```
   */
  defaultLabels?: Record<string, string>;
}

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
