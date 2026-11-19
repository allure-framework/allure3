export function loadFromLocalStorage<T>(key: string, defaultValue: T): T;
export function loadFromLocalStorage<T>(key: string): T | undefined;
export function loadFromLocalStorage<T>(key: string, defaultValue?: T): T | undefined {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

const REPORT_STORAGE_KEY_PREFIX = "allure-report";

/**
 * Identifies the report in browser storage by the directory it is served from.
 *
 * Browser storage is shared by every page of an origin, so reports hosted side by side
 * (e.g. `/reports/1/` and `/reports/2/`) would otherwise overwrite each other's state.
 * The directory, unlike the per-run report uuid, stays the same when a report is
 * regenerated in place, so a project published to a stable URL keeps its state across runs.
 */
export const getReportStorageScope = (pathname: string = globalThis.location?.pathname ?? "/"): string => {
  const directory = pathname.slice(0, pathname.lastIndexOf("/") + 1);

  return directory.startsWith("/") ? directory : `/${directory}`;
};

/**
 * Builds a storage key for state that belongs to the current report (tree state, selected environment, etc.).
 * User preferences that should follow the user between reports (theme, language, layout) must keep global keys.
 */
export const getReportStorageKey = (key: string, scope: string = getReportStorageScope()): string =>
  `${REPORT_STORAGE_KEY_PREFIX}:${scope}:${key}`;
