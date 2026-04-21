import { toPosixPath } from "@allurereport/core-api";

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
    const dataByName = globalThis.allureReportData ?? {};

    if (name in dataByName) {
      return resolve(dataByName[name] as string);
    }

    const posixKey = toPosixPath(name);

    if (posixKey in dataByName) {
      return resolve(dataByName[posixKey] as string);
    }

    const legacyBackslashKey = posixKey.replace(/\//g, "\\");

    if (legacyBackslashKey in dataByName) {
      return resolve(dataByName[legacyBackslashKey] as string);
    }

    return reject(new Error(`Data "${name}" not found!`));
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

export const errorMessageFromUnknown = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const fetchReportJsonData = async <T>(path: string, params?: { bustCache: boolean }) => {
  let url: string;

  try {
    url = await reportDataUrl(path, undefined, params);
  } catch {
    // In single-file mode loadReportData throws a plain Error when a key is absent.
    // Convert to ReportFetchError(404) so callers behave the same as in multi-file mode.
    throw new ReportFetchError(
      `Failed to fetch ${path}: data not found`,
      new Response(null, { status: 404, statusText: "Not Found" }),
    );
  }

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
