import type { HistoryDataPoint, KnownTestFailure } from "@allurereport/core-api";
import type { Plugin, QualityGateConfig, ReportFiles } from "@allurereport/plugin-api";
import type { ResultsReader } from "@allurereport/reader-api";

export interface FullConfig {
  name: string;
  output: string;
  reportFiles: ReportFiles;
  readers?: ResultsReader[];
  plugins?: PluginInstance[];
  history: HistoryDataPoint[];
  historyPath: string;
  appendHistory?: boolean;
  knownIssuesPath: string;
  known?: KnownTestFailure[];
  qualityGate?: QualityGateConfig;
  defaultLabels?: Record<string, string>;
  // TODO: https://github.com/qameta/allure3/issues/180
  realTime?: any;
}

export interface PluginInstance {
  id: string;
  enabled: boolean;
  plugin: Plugin;
  options: Record<string, any>;
}
