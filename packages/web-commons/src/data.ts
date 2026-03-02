import { getApiReportUrl } from "./apiReportClient.js";
import type { AllureReportApiOptions } from "./types/reportOptions.js";
import type { ReportDataClient } from "./reportDataClient.js";
import { StaticReportClient, ApiReportClient } from "./reportDataClient.js";

/**
 * Hash which attaches to any report file to prevent caching
 */
export const ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY = "__allure_report_live_reload_hash__";

function isApiMode(): boolean {
  const opts = globalThis.allureReportOptions as AllureReportApiOptions | undefined;
  return Boolean(opts?.apiBaseUrl);
}

export const ensureReportDataReady = () =>
  new Promise((resolve) => {
    const waitForReady = () => {
      if (globalThis.allureReportDataReady) return resolve(true);
      setTimeout(waitForReady, 30);
    };
    waitForReady();
  });

export const loadReportData = async (name: string): Promise<string> => {
  await ensureReportDataReady();

  return new Promise((resolve, reject) => {
    if (globalThis.allureReportData[name]) {
      return resolve(globalThis.allureReportData[name] as string);
    } else {
      return reject(new Error(`Data "${name}" not found!`));
    }
  });
};

/**
 * Resolves report path to URL for static report only (no API branch).
 * Used by StaticReportClient. For full URL resolution including API mode, use reportDataUrl().
 */
export async function getStaticReportDataUrl(
  path: string,
  contentType: string = "application/octet-stream",
  params?: { bustCache?: boolean },
): Promise<string> {
  if (globalThis.allureReportData) {
    const [dataKey] = path.split("?");
    const value = await loadReportData(dataKey);
    return `data:${contentType};base64,${value}`;
  }

  const baseEl = globalThis.document.head.querySelector("base")?.href ?? "https://localhost";
  const url = new URL(path, baseEl);
  const liveReloadHash = globalThis.localStorage.getItem(ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY);
  const cacheKey = getReportOptions<{ cacheKey?: string }>()?.cacheKey;

  if (liveReloadHash) {
    url.searchParams.set("live_reload_hash", liveReloadHash);
  }

  if (params?.bustCache && cacheKey) {
    url.searchParams.set("v", cacheKey);
  }

  return url.toString();
}

export const reportDataUrl = async (
  path: string,
  contentType: string = "application/octet-stream",
  params?: { bustCache: boolean },
) => {
  if (isApiMode()) {
    const apiUrl = getApiReportUrl(path);
    if (apiUrl) return apiUrl;
    if (path === "widgets/environments.json" || path.startsWith("widgets/environments")) {
      return "data:application/json;base64,W10=";
    }
  }

  return getStaticReportDataUrl(path, contentType, params);
};

export class ReportFetchError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
  ) {
    super(message);
  }
}

let reportClientCache: ReportDataClient | undefined;

/**
 * Clears the cached report client. Used in tests to isolate mode switching.
 */
export function clearReportClientCache(): void {
  reportClientCache = undefined;
}

/**
 * Returns the report data client for the current mode (static or API).
 * Choice is based on allureReportOptions.apiBaseUrl. Cached per session.
 */
export function getReportClient(): ReportDataClient {
  if (reportClientCache !== undefined) return reportClientCache;
  if (isApiMode()) {
    reportClientCache = new ApiReportClient();
  } else {
    reportClientCache = new StaticReportClient(getStaticReportDataUrl, (msg, res) => new ReportFetchError(msg, res));
  }
  return reportClientCache;
}

export const fetchReportJsonData = async <T>(path: string, params?: { bustCache: boolean }) => {
  return getReportClient().getJson<T>(path, params);
};

export const fetchReportAttachment = async (path: string, contentType?: string) => {
  return getReportClient().getAttachment(path, contentType);
};

export const getReportOptions = <T>() => {
  return globalThis.allureReportOptions as Readonly<T>;
};
