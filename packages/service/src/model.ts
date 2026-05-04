import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { HistoryDataPoint } from "@allurereport/core-api";

export const DEFAULT_HISTORY_SERVICE_URL = "https://history.allurereport.org";

export const ALLURE_FILES_DIRNAME = resolve(homedir(), ".allure");

export const ALLURE_LOGIN_EXCHANGE_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "exchange_token");

export const ALLURE_ACCESS_TOKEN_PATH = join(ALLURE_FILES_DIRNAME, "access_token");

export interface AllureServiceApiClient {
  downloadHistory(payload: { repo?: string; branch?: string; limit?: number }): Promise<HistoryDataPoint[]>;
  createReport(payload: { reportName: string; reportUuid?: string; repo?: string; branch?: string }): Promise<URL>;
  completeReport(payload: { reportUuid: string; historyPoint: HistoryDataPoint }): Promise<unknown>;
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
}
