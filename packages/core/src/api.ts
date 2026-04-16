import type { CategoriesConfig, KnownTestFailure } from "@allurereport/core-api";
import type { Plugin, ReportFiles, Config } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}

type FullConfigRequiredFromConfig = Required<Pick<Config, "name" | "output" | "open" | "knownIssuesPath">>;

export interface FullConfig
  extends
    Omit<Config, "name" | "output" | "open" | "knownIssuesPath" | "plugins" | "port">,
    FullConfigRequiredFromConfig {
  port: Config["port"] | undefined;
  allowedEnvironments?: Config["allowedEnvironments"];
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  known?: KnownTestFailure[];
  realTime?: any;
  qualityGate?: Config["qualityGate"];
  categories?: CategoriesConfig;
  globalAttachments?: string[];
}
