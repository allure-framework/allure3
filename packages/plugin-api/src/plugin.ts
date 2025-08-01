import type { CiDescriptor, Statistic, TestError, TestResult, TestStatus } from "@allurereport/core-api";
import type { AllureStore } from "./store.js";

export interface PluginDescriptor {
  import?: string;
  enabled?: boolean;
  options?: Record<string, any>;
}

export interface ReportFiles {
  addFile(path: string, data: Buffer): Promise<string>;
}

export interface PluginState {
  set(key: string, value: any): Promise<void>;

  get<T>(key: string): Promise<T>;

  unset(key: string): Promise<void>;
}

export interface PluginContext {
  id: string;
  publish: boolean;
  state: PluginState;
  allureVersion: string;
  reportUuid: string;
  reportName: string;
  reportFiles: ReportFiles;
  ci?: CiDescriptor;
  dispatcher: PublicEventsDispatcher;
}

/**
 * Reduced test result information that can be used in summary
 */
export type SummaryTestResult = Pick<TestResult, "name" | "id" | "status" | "duration">;

export interface PluginSummary {
  href?: string;
  remoteHref?: string;
  jobHref?: string;
  pullRequestHref?: string;
  name: string;
  stats: Statistic;
  status: TestStatus;
  duration: number;
  plugin?: string;
  newTests?: SummaryTestResult[];
  flakyTests?: SummaryTestResult[];
  retryTests?: SummaryTestResult[];
  createdAt?: number;
}

export interface BatchOptions {
  maxTimeout?: number;
}

export interface RealtimeSubscriber {
  onGlobalError(listener: (error: TestError) => Promise<void>): void;

  onTerminationRequest(listener: (code: number, reason?: string) => Promise<void>): void;

  onTestResults(listener: (trIds: string[]) => Promise<void>, options?: BatchOptions): void;

  onTestFixtureResults(listener: (tfrIds: string[]) => Promise<void>, options?: BatchOptions): void;

  onAttachmentFiles(listener: (afIds: string[]) => Promise<void>, options?: BatchOptions): void;
}

/**
 * An abstraction to distribute data from the report
 * **Can be called only inside the report to prevent collisions and report data inconsistency**
 */
export interface PrivateEventsDispatcher {
  sendTestResult(trId: string): void;

  sendTestFixtureResult(tfrId: string): void;

  sendAttachmentFile(afId: string): void;
}

/**
 * The main communication bus for the report plugins
 * Can be called everywhere and distributes data from the report and outer sources
 */
export interface PublicEventsDispatcher {
  // TODO: string is not a good type for describing errors
  sendGlobalError(error: TestError): void;

  sendTerminationRequest(code: number, reason?: string): void;
}

export interface Plugin {
  start?(context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void>;

  update?(context: PluginContext, store: AllureStore): Promise<void>;

  done?(context: PluginContext, store: AllureStore): Promise<void>;

  info?(context: PluginContext, store: AllureStore): Promise<PluginSummary>;
}
