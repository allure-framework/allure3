import type {
  AllureServiceConfig,
  CategoriesConfig,
  DefaultLabelsConfig,
  EnvironmentsConfig,
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
  /**
   * Enable unified storage for attachments and static assets across plugins.
   * When enabled, files with the same content are stored once in the `_shared/` directory
   * and referenced by every plugin instead of being copied into each report.
   */
  unifiedStorage?: boolean;
}

export const SHARED_DIR = "_shared";

export const ATTACHMENTS_DIR = "data/attachments";

export const defineConfig = (allureConfig: Config): Config => {
  return allureConfig;
};
