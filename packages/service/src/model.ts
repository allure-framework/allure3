import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { AllureLogger, AllureServiceConfig, HistoryDataPoint } from "@allurereport/core-api";

export const DEFAULT_HISTORY_SERVICE_URL = "https://history.allurereport.org";

export const ALLURE_FILES_DIRNAME = resolve(homedir(), ".allure");

export const ALLURE_LOGIN_EXCHANGE_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "exchange_token");

export const ALLURE_ACCESS_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "access_token");

export const ALLURE_SERVICE_STORAGE_PREFIX = "ars1.";

export const ALLURE_SERVICE_TESTOPS_PREFIX = "ato1.";

export type UploadReportConfig = Required<
  Pick<AllureServiceConfig, "uploadConcurrency" | "uploadMaxAttempts" | "uploadMaxSimultaneousFailures">
>;

export type AllureServiceApiClientConfig = Partial<UploadReportConfig> & {
  accessToken: string;
  private?: boolean;
};

export type UploadReportPayload = {
  reportUuid: string;
  pluginId?: string;
  files: Record<string, string> | Record<string, string>[];
  onProgress?: (uploadedFilesDelta?: number) => void;
  uploadBatchMaxBytes?: number;
  signal?: AbortSignal;
};

export type UploadReportFilePayload = {
  filename: string;
  file?: Buffer;
  filepath?: string;
  signal?: AbortSignal;
};

export type UploadReportFilesPayload = {
  reportUuid: string;
  pluginId?: string;
  files: UploadReportFilePayload[];
  signal?: AbortSignal;
};

export type UploadReportResult = {
  indexHref?: string;
  hrefs: Record<string, string>;
};

export abstract class AllureServiceApiClient {
  readonly config: AllureServiceApiClientConfig & UploadReportConfig;

  protected constructor(
    config: AllureServiceApiClientConfig,
    protected readonly logger: AllureLogger = console,
  ) {
    this.config = {
      ...config,
      uploadConcurrency: Number.isFinite(config?.uploadConcurrency) ? config.uploadConcurrency! : 10,
      uploadMaxAttempts: config?.uploadMaxAttempts ?? 5,
      uploadMaxSimultaneousFailures: config?.uploadMaxSimultaneousFailures ?? 5,
    };
  }

  abstract downloadHistory(payload: { repo?: string; branch?: string; limit?: number }): Promise<HistoryDataPoint[]>;
  abstract createReport(payload: {
    reportName: string;
    reportUuid?: string;
    repo?: string;
    branch?: string;
  }): Promise<URL>;
  abstract completeReport(payload: { reportUuid: string; historyPoint?: HistoryDataPoint }): Promise<unknown>;
  abstract deleteReport(payload: { reportUuid: string; pluginId?: string }): Promise<unknown>;
  abstract addReportAsset(payload: UploadReportFilePayload): Promise<unknown>;
  abstract addReportAssets?(payload: { files: UploadReportFilePayload[]; signal?: AbortSignal }): Promise<unknown>;
  abstract addReportFile(payload: UploadReportFilePayload & { reportUuid: string; pluginId?: string }): Promise<string>;
  abstract addReportFiles?(payload: UploadReportFilesPayload): Promise<Record<string, string>>;
  abstract uploadReport(payload: UploadReportPayload): Promise<UploadReportResult>;
}
