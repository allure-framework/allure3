import type {
  AttachmentLink,
  CategoryDefinition,
  CiDescriptor,
  Statistic,
  TestError,
  TestResult,
  TestStatus,
} from "@allurereport/core-api";
import type { QualityGateValidationResult } from "./qualityGate.js";
import type { ResultFile } from "./resultFile.js";
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
  reportUrl?: string;
  output: string;
  ci?: CiDescriptor;
  categories?: CategoryDefinition[];
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
  /**
   * May contain useful information provided by plugins (for example it's id, single file mode, etc.)
   * The field can be used in integrations to make better experience
   */
  meta?: Record<string, any>;
}

export interface ExitCode {
  /**
   * Actual exit code the allure command exited with
   */
  actual?: number;
  /**
   * Original exit code of the process inside the allure command exited with
   */
  original: number;
}

export interface PluginGlobals {
  exitCode?: ExitCode;
  errors: TestError[];
  attachments: AttachmentLink[];
}

export interface BatchOptions {
  maxTimeout?: number;
}

export interface RealtimeSubscriber {
  onGlobalAttachment(listener: (payload: { attachment: ResultFile; fileName?: string }) => Promise<void>): () => void;

  onGlobalExitCode(listener: (payload: ExitCode) => Promise<void>): () => void;

  onGlobalError(listener: (error: TestError) => Promise<void>): () => void;

  onQualityGateResults(listener: (payload: QualityGateValidationResult[]) => Promise<void>): () => void;

  onTestResults(listener: (trIds: string[]) => Promise<void>, options?: BatchOptions): () => void;

  onTestFixtureResults(listener: (tfrIds: string[]) => Promise<void>, options?: BatchOptions): () => void;

  onAttachmentFiles(listener: (afIds: string[]) => Promise<void>, options?: BatchOptions): () => void;
}

export interface RealtimeEventsDispatcher {
  sendGlobalAttachment(attachment: ResultFile, fileName?: string): void;

  sendGlobalExitCode(payload: ExitCode): void;

  sendGlobalError(error: TestError): void;

  sendQualityGateResults(payload: QualityGateValidationResult[]): void;

  sendTestResult(trId: string): void;

  sendTestFixtureResult(tfrId: string): void;

  sendAttachmentFile(afId: string): void;
}

export interface Plugin {
  start?(context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void>;

  update?(context: PluginContext, store: AllureStore): Promise<void>;

  done?(context: PluginContext, store: AllureStore): Promise<void>;

  info?(context: PluginContext, store: AllureStore): Promise<PluginSummary | undefined>;
}
