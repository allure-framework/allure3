/**
 * Hash which attaches to any report file to prevent caching
 */
export const ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY = "__allure_report_live_reload_hash__";

export const ensureReportDataReady = () =>
  new Promise((resolve) => {
    const waitForReady = () => {
      if (globalThis.allureReportDataReady) {
        return resolve(true);
      }

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

export const reportDataUrl = async (
  path: string,
  contentType: string = "application/octet-stream",
  params?: { bustCache: boolean },
) => {
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
};

export class ReportFetchError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
  ) {
    super(message);
  }
}

export const fetchReportJsonData = async <T>(path: string, params?: { bustCache: boolean }) => {
  const url = await reportDataUrl(path, undefined, params);
  const res = await globalThis.fetch(url);

  if (!res.ok) {
    throw new ReportFetchError(`Failed to fetch ${url}, response status: ${res.status}`, res);
  }

  const data = res.json();

  return data as T;
};

export const fetchReportAttachment = async (path: string, contentType?: string) => {
  const url = await reportDataUrl(path, contentType);

  return globalThis.fetch(url);
};

export const getReportOptions = <T>() => {
  return globalThis.allureReportOptions as Readonly<T>;
};
