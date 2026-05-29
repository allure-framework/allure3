import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { AllureServiceConfig, HistoryDataPoint } from "@allurereport/core-api";

export const DEFAULT_HISTORY_SERVICE_URL = "https://history.allurereport.org";

export const ALLURE_FILES_DIRNAME = resolve(homedir(), ".allure");

export const ALLURE_LOGIN_EXCHANGE_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "exchange_token");

export const ALLURE_ACCESS_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "access_token");

export const ALLURE_SERVICE_STORAGE_PREFIX = "ars1.";

export const ALLURE_SERVICE_TESTOPS_PREFIX = "ato1.";

export type UploadReportConfig = Required<
  Pick<AllureServiceConfig, "uploadConcurrency" | "uploadMaxAttempts" | "uploadMaxSimultaneousFailures">
>;

export type AllureServiceApiClientConfig = UploadReportConfig & {
  accessToken: string;
  private?: boolean;
};

export type UploadReportPayload = {
  reportUuid: string;
  pluginId?: string;
  files: Record<string, string>;
  onProgress?: () => void;
};

export type UploadReportResult = {
  indexHref?: string;
  hrefs: Record<string, string>;
};

export interface AllureServiceApiClient {
  downloadHistory(payload: { repo?: string; branch?: string; limit?: number }): Promise<HistoryDataPoint[]>;
  createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }): Promise<URL>;
  completeReport(payload: { reportUuid: string; historyPoint?: HistoryDataPoint }): Promise<unknown>;
  deleteReport(payload: { reportUuid: string; pluginId?: string }): Promise<unknown>;
  addReportAsset(payload: {
    filename: string;
    file?: Buffer;
    filepath?: string;
    signal?: AbortSignal;
  }): Promise<unknown>;
  addReportFile(payload: {
    reportUuid: string;
    pluginId?: string;
    filename: string;
    file?: Buffer;
    filepath?: string;
    signal?: AbortSignal;
  }): Promise<string>;
  uploadReport(payload: UploadReportPayload): Promise<UploadReportResult>;
}
