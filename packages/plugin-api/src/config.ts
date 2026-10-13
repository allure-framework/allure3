import type {
  AllureServiceConfig,
  CategoriesConfig,
  DefaultLabelsConfig,
  DynamicEnvironmentsConfig,
  EnvironmentsConfig,
  FlakyDetectionConfig,
  PerformanceConfig,
  ReportVariables,
  ResolutionsConfig,
} from "@allurereport/core-api";

import type { PluginDescriptor } from "./plugin.js";
import type { QualityGateConfig } from "./qualityGate.js";

export interface Config {
  name?: string;
  output?: string;
  open?: boolean;
  port?: string;
  hideLabels?: (string | RegExp)[];
  historyPath?: string;
  historyBaseUrl?: string;
  historyLimit?: number;
  flakyDetection?: FlakyDetectionConfig;
  resolutions?: ResolutionsConfig;
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
  allowedEnvironments?: string[];
  environments?: EnvironmentsConfig;
  /**
   * Derives an environment from test result labels as results arrive, so environments
   * don't have to be listed upfront. Statically configured `environments` take priority.
   * @example
   * ```js
   * dynamicEnvironments: ({ labels }) => labels.find(({ name }) => name === "host")?.value
   * // or declaratively
   * dynamicEnvironments: { label: "host", pattern: /^[\w-]+/ }
   * ```
   */
  dynamicEnvironments?: DynamicEnvironmentsConfig;
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
  performance?: PerformanceConfig;
  allureService?: AllureServiceConfig;
  categories?: CategoriesConfig;
  /**
   * Array of glob patterns or full paths to match files in the working directory which should be attached to allure report as global attachments
   */
  globalAttachments?: string[];
  /**
   * Glob patterns or paths used when reading Allure results directories.
   * Applies to generate-family and live commands when CLI patterns are omitted.
   * Empty string / empty array are treated as unset.
   */
  resultsDir?: string | string[];
}

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
