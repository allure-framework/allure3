import type {
  CategoriesConfig,
  PerformanceConfig,
  ResolvedAllureServiceConfig,
} from "@allurereport/core-api";
import type { Plugin, ReportFiles, Config } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}

type FullConfigRequiredFromConfig = Required<Pick<Config, "name" | "output" | "open">>;

export interface FullConfig
  extends
    Omit<Config, "name" | "output" | "open" | "allureService" | "plugins" | "port" | "resultsDir">,
    FullConfigRequiredFromConfig {
  port: Config["port"] | undefined;
  allowedEnvironments?: Config["allowedEnvironments"];
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  realTime?: any;
  qualityGate?: Config["qualityGate"];
  performance?: PerformanceConfig;
  allureService?: ResolvedAllureServiceConfig;
  categories?: CategoriesConfig;
  globalAttachments?: string[];
  /**
   * Normalized results directory patterns from config (unset when empty / only empty-string entries).
   */
  resultsDir?: string[];
}
