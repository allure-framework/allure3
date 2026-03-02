/**
 * API report client: builds backend URLs from report paths and fetches data.
 * Used when allureReportOptions.apiBaseUrl is set (frontend+backend mode).
 */
import type { AllureReportApiOptions } from "./types/reportOptions.js";
import {
  adaptTreeResponse,
  adaptWidgetToStatistic,
  adaptNavResponse,
  adaptTestResultToClassic
} from "./adapters/backendAdapters.js";

const API_PREFIX = "/api/v1";

function getApiOptions(): AllureReportApiOptions | undefined {
  return globalThis.allureReportOptions as AllureReportApiOptions | undefined;
}

export class ApiReportFetchError extends Error {
  constructor(
    message: string,
    public readonly response: Response
  ) {
    super(message);
    this.name = "ApiReportFetchError";
  }
}

/**
 * Returns backend URL for the given report path, or null if API mode is off.
 */
export function getApiReportUrl(
  path: string,
  params?: { launchId?: string }
): string | null {
  const opts = getApiOptions();
  const apiBase = opts?.apiBaseUrl;
  const launchId = params?.launchId ?? opts?.launchId;

  if (!apiBase) return null;
  const base = apiBase.replace(/\/$/, "") + API_PREFIX;

  // widgets/*.json and widgets/{env}/*.json (Awesome uses per-env paths)
  if (path.startsWith("widgets/")) {
    const pathAfterWidgets = path.replace(/\.json$/, "").replace("widgets/", "");
    const env = pathAfterWidgets.includes("/") ? pathAfterWidgets.split("/")[0] : undefined;
    const name = pathAfterWidgets.includes("/") ? pathAfterWidgets.split("/")[1]! : pathAfterWidgets;

    const qs = (overrides?: { env?: string }) => {
      const params = new URLSearchParams();
      if (launchId) params.set("launch_id", launchId);
      if (overrides?.env ?? env) params.set("environment", overrides?.env ?? env!);
      const s = params.toString();
      return s ? `?${s}` : "";
    };

    if (pathAfterWidgets === "nav" || name === "nav") {
      if (!launchId) return null;
      return `${base}/launches/${encodeURIComponent(launchId)}/results${qs()}`;
    }
    if (pathAfterWidgets === "environments") {
      if (!launchId) return null;
      return `${base}/launches/${encodeURIComponent(launchId)}/environments`;
    }
    if (pathAfterWidgets === "ci" || name === "ci") {
      if (!launchId) return null;
      return `${base}/launches/${encodeURIComponent(launchId)}/ci`;
    }
    if (name === "tree") {
      return `${base}/trees/suites${qs()}`;
    }
    if (name === "packages") {
      return `${base}/trees/packages${qs()}`;
    }
    if (name === "behaviors") {
      return `${base}/trees/behaviors${qs()}`;
    }
    if (name === "categories") {
      return `${base}/trees/categories${qs()}`;
    }
    if (name === "charts") {
      return `${base}/widgets/charts${qs()}`;
    }
    if (
      name === "summary" ||
      name === "statistic" ||
      name === "allure_statistic" ||
      name === "allure_pie_chart"
    ) {
      const widgetName = name === "statistic" || name === "allure_statistic" || name === "allure_pie_chart" ? "status" : "summary";
      return `${base}/widgets/${widgetName}${qs()}`;
    }
    if (name === "globals") {
      return `${base}/widgets/globals${launchId ? `?launch_id=${encodeURIComponent(launchId)}` : ""}`;
    }
    if (name === "tree-filters") {
      return `${base}/widgets/tree-filters${launchId ? `?launch_id=${encodeURIComponent(launchId)}` : ""}`;
    }
    if (name === "variables") {
      const params = new URLSearchParams();
      if (launchId) params.set("launch_id", launchId);
      if (env) params.set("environment", env);
      const s = params.toString();
      return `${base}/widgets/variables${s ? `?${s}` : ""}`;
    }
    if (name === "allure_environment") {
      return `${base}/widgets/allure_environment${launchId ? `?launch_id=${encodeURIComponent(launchId)}` : ""}`;
    }
    if (name === "timeline") {
      return `${base}/widgets/timeline${launchId ? `?launch_id=${encodeURIComponent(launchId)}` : ""}`;
    }
    if (name === "quality-gate") {
      return `${base}/widgets/quality-gate${launchId ? `?launch_id=${encodeURIComponent(launchId)}` : ""}`;
    }
    return null;
  }

  // data/test-results/{id}.json
  const testResultMatch = path.match(/^data\/test-results\/([^/?.]+)\.json$/);
  if (testResultMatch) {
    return `${base}/test-results/${encodeURIComponent(testResultMatch[1])}`;
  }

  // data/test-env-groups/{id}.json
  const testEnvGroupMatch = path.match(/^data\/test-env-groups\/([^/?.]+)\.json$/);
  if (testEnvGroupMatch && launchId) {
    return `${base}/test-env-groups/${encodeURIComponent(testEnvGroupMatch[1])}?launch_id=${encodeURIComponent(launchId)}`;
  }

  // attachments: path may be "attachments/{uid}" or similar
  if (path.startsWith("attachments/")) {
    const uid = path.replace("attachments/", "").split("/")[0].split("?")[0];
    if (uid) return `${base}/attachments/${encodeURIComponent(uid)}`;
  }

  return null;
}

/**
 * Fetches JSON from backend for the given report path.
 * Unwraps backend SuccessResponse (response.data) and applies path-specific adapters.
 */
export async function fetchReportJsonFromApi<T>(
  path: string,
  options?: { launchId?: string }
): Promise<T> {
  const url = getApiReportUrl(path, options);
  if (!url) {
    const opts = getApiOptions();
    throw new Error(
      `apiReportClient: apiBaseUrl not set or path not mapped. path="${path}" apiBaseUrl=${opts?.apiBaseUrl ? "set" : "NOT SET"} launchId=${options?.launchId ?? opts?.launchId ?? "NOT SET"}`
    );
  }

  const res = await globalThis.fetch(url);
  if (!res.ok) {
    throw new ApiReportFetchError(`Failed to fetch ${url}, response status: ${res.status}`, res);
  }

  const json = (await res.json()) as { data?: unknown };
  let raw = json.data !== undefined ? json.data : json;

  if (
    path.includes("/tree.json") ||
    path.includes("/packages.json") ||
    path.includes("/behaviors.json") ||
    path.includes("/categories.json")
  ) {
    raw = adaptTreeResponse(raw);
  } else if (
    path.includes("statistic.json") ||
    path.includes("allure_statistic") ||
    path.includes("allure_pie_chart")
  ) {
    const widget = raw as { data?: unknown };
    raw = adaptWidgetToStatistic(widget?.data ?? widget);
  } else if (path.includes("widgets/charts")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/summary")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/globals")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/tree-filters")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/") && path.includes("variables") && !path.includes("allure_environment")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/allure_environment")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/timeline")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/quality-gate")) {
    const widget = raw as { data?: unknown };
    raw = widget?.data ?? widget;
  } else if (path.includes("widgets/environments")) {
    const arr = (raw as Array<{ id: string; name: string }>) ?? [];
    raw = Array.isArray(arr) ? arr : [];
  } else if (path.includes("widgets/ci")) {
    // raw is already CiDescriptor from response.data
  } else if (path.includes("widgets/nav")) {
    raw = adaptNavResponse(json);
  } else if (path.includes("data/test-results/")) {
    raw = adaptTestResultToClassic(raw);
  }

  return raw as T;
}

/**
 * Fetches attachment (binary) from backend.
 * Path should be "attachments/{uid}" or similar.
 */
export async function fetchReportAttachmentFromApi(path: string): Promise<Response> {
  const opts = getApiOptions();
  const apiBase = opts?.apiBaseUrl;
  if (!apiBase) {
    throw new Error("apiReportClient: apiBaseUrl not set");
  }

  let uid: string;
  if (path.startsWith("attachments/")) {
    uid = path.replace("attachments/", "").split("/")[0].split("?")[0];
  } else {
    uid = path.split("/").pop()?.split("?")[0] ?? path;
  }

  const base = apiBase.replace(/\/$/, "");
  const url = `${base}${API_PREFIX}/attachments/${encodeURIComponent(uid)}`;
  return globalThis.fetch(url);
}
