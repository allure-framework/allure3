import { toPosixPath } from "@allurereport/core-api";

/**
 * Hash which attaches to any report file to prevent caching
 */
export const ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY = "__allure_report_live_reload_hash__";

/**
 * Strip parameters and reject malformed / injection-prone MIME types.
 * Attachment contentType comes from untrusted test results.
 */
export const sanitizeContentType = (contentType?: string): string => {
  if (!contentType) {
    return "application/octet-stream";
  }

  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  // type/subtype with limited token characters (RFC 6838-ish)
  if (!/^[a-z0-9][a-z0-9!#$&\-^_.+]*\/[a-z0-9][a-z0-9!#$&\-^_.+]*$/i.test(base)) {
    return "application/octet-stream";
  }

  return base;
};

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

const relativeReportUrl = (path: string, params?: { bustCache: boolean }) => {
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

  // Never allow absolute attachment/report data URLs from untrusted path inputs.
  // `new URL(path, base)` keeps path relative to the report base when path is relative.
  return url.toString();
};

export const reportDataUrl = async (
  path: string,
  contentType: string = "application/octet-stream",
  params?: { bustCache: boolean },
) => {
  const safeContentType = sanitizeContentType(contentType);

  // Reject absolute / scheme-based paths so hybrid fallback cannot be turned into open redirects.
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path) || path.startsWith("//")) {
    throw new Error(`Refusing absolute report data path: ${path}`);
  }

  if (globalThis.allureReportData) {
    const [dataKey] = path.split("?");

    try {
      const value = await loadReportData(dataKey);

      return `data:${safeContentType};base64,${value}`;
    } catch {
      // Hybrid single-file mode: heavy attachments may live as sibling files next to index.html.
      // Fall through to a relative fetch under the report base.
    }
  }

  return relativeReportUrl(path, params);
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
  } catch (error) {
    // Absolute paths are rejected; convert to a 404-style fetch error for callers.
    if (error instanceof Error && /absolute report data path/i.test(error.message)) {
      throw new ReportFetchError(
        `Failed to fetch ${path}: invalid path`,
        new Response(null, { status: 404, statusText: "Not Found" }),
      );
    }

    throw error;
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
