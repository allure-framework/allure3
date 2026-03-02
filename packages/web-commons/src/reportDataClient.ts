/**
 * Abstract report data client and implementations (static report vs API backend).
 * Typing is preserved at call site via getJson<T>(path). getReportClient() chooses
 * implementation based on allureReportOptions.apiBaseUrl.
 */

import {
  getApiReportUrl,
  fetchReportJsonFromApi,
  fetchReportAttachmentFromApi,
} from "./apiReportClient.js";

/** Resolves a report path to a URL for static report (no API branch). */
export type ResolveStaticUrl = (
  path: string,
  contentType?: string,
  params?: { bustCache?: boolean },
) => Promise<string>;

export interface ReportDataClient {
  getJson<T>(path: string, params?: { bustCache?: boolean }): Promise<T>;
  getAttachment(path: string, contentType?: string): Promise<Response>;
}

/**
 * Client for static report: resolves URL via provided resolver (e.g. getStaticReportDataUrl),
 * fetches, returns JSON as T without adapters.
 */
export class StaticReportClient implements ReportDataClient {
  constructor(
    private readonly resolveUrl: ResolveStaticUrl,
    private readonly createFetchError?: (message: string, response: Response) => Error,
  ) {}

  async getJson<T>(path: string, params?: { bustCache?: boolean }): Promise<T> {
    const url = await this.resolveUrl(path, "application/json", params);
    const res = await globalThis.fetch(url);
    if (!res.ok) {
      const err =
        this.createFetchError?.(`Failed to fetch ${url}, response status: ${res.status}`, res) ??
        new Error(`Failed to fetch ${url}, response status: ${res.status}`);
      throw err;
    }
    return res.json() as Promise<T>;
  }

  async getAttachment(path: string, contentType?: string): Promise<Response> {
    const url = await this.resolveUrl(path, contentType ?? "application/octet-stream");
    return globalThis.fetch(url);
  }
}

/**
 * Client for API-backed report: builds URL via getApiReportUrl, fetches,
 * unwraps response.data and applies path-specific adapters. Options read from
 * globalThis.allureReportOptions per call.
 */
export class ApiReportClient implements ReportDataClient {
  async getJson<T>(path: string, params?: { bustCache?: boolean }): Promise<T> {
    const opts = globalThis.allureReportOptions as { apiBaseUrl?: string; launchId?: string } | undefined;
    const launchId = opts?.launchId;
    if (path === "widgets/environments.json" || path.startsWith("widgets/environments")) {
      const url = getApiReportUrl(path, { launchId });
      if (!url || !launchId) return [] as T;
    }
    if (path === "widgets/ci.json" || path.startsWith("widgets/ci")) {
      const url = getApiReportUrl(path, { launchId });
      if (!url || !launchId) return null as T;
    }
    return fetchReportJsonFromApi<T>(path, { launchId });
  }

  async getAttachment(path: string, _contentType?: string): Promise<Response> {
    return fetchReportAttachmentFromApi(path);
  }
}
