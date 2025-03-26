import type { Statistic } from "@allurereport/core-api";
import type { AllureStore } from "./store.js";

export interface PluginDescriptor {
  import?: string;
  enabled?: boolean;
  options?: Record<string, any>;
}

export interface ReportFiles {
  addFile(path: string, data: Buffer): Promise<void>;
}

export interface PluginState {
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<void>;
  unset(key: string): Promise<void>;
}

export interface PluginContext {
  state: PluginState;
  allureVersion: string;
  reportUuid: string;
  reportName: string;
  reportFiles: ReportFiles;
}

export interface PluginInfo {
  name: string;
  id: string;
  stats: Statistic;
}

export interface BatchOptions {
  maxTimeout?: number;
}

export interface Realtime {
  onTestResults(listener: (trIds: string[]) => Promise<void>, options?: BatchOptions): void;
  onTestFixtureResults(listener: (tfrIds: string[]) => Promise<void>, options?: BatchOptions): void;
  onAttachmentFiles(listener: (afIds: string[]) => Promise<void>, options?: BatchOptions): void;
}

export interface Plugin {
  start?(context: PluginContext, store: AllureStore, realtime: Realtime): Promise<void>;
  update?(context: PluginContext, store: AllureStore): Promise<void>;
  done?(context: PluginContext, store: AllureStore): Promise<void>;
}
