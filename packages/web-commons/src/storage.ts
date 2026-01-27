import { getReportOptions } from "./data.js";

const reportOptions = getReportOptions<{ reportUuid?: string; reportHistory?: string[] }>();

const createStorageKey = (key: string, uuid: string) => `${key}:${uuid}`;

export const store = (key: string, value: any) => {
  const { reportUuid } = reportOptions;
  const currentKey = reportUuid ? createStorageKey(key, reportUuid) : undefined;
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);

  if (currentKey) {
    localStorage.setItem(currentKey, stringValue);
    return;
  }

  localStorage.setItem(key, stringValue);
};

const restoreWithReportScope = (key: string) => {
  const { reportUuid, reportHistory } = reportOptions;
  const currentKey = reportUuid ? createStorageKey(key, reportUuid) : undefined;
  const historyKeys = reportHistory?.map((uuid) => createStorageKey(key, uuid)) ?? [];

  // Check values in priority order: current report -> history (earliest to latest) -> keyless
  let foundValue: string | null = null;

  // Priority 1: Current report
  if (currentKey) {
    foundValue = localStorage.getItem(currentKey);
  }

  // Priority 2: History reports (from earliest to latest)
  if (foundValue === null) {
    for (const historyKey of historyKeys) {
      foundValue = localStorage.getItem(historyKey);
      if (foundValue) {
        break;
      }
    }
  }

  // Priority 3: Keyless value
  if (foundValue === null) {
    foundValue = localStorage.getItem(key);
  }

  // If we found a value, clean up all variants and store it under current key
  if (foundValue && currentKey) {
    // Remove all history keys
    for (const historyKey of historyKeys) {
      localStorage.removeItem(historyKey);
    }
    // Remove keyless value
    localStorage.removeItem(key);
    // Store found value under current key
    localStorage.setItem(currentKey, foundValue);
  }

  return foundValue;
};

const jsonParseSafe = <R>(item: string | null): R | null => {
  if (item === null) {
    return null;
  }

  try {
    return JSON.parse(item) as R;
  } catch {
    return item as unknown as R;
  }
};

export const restore = <R>(key: string, scope: "report" | "none" = "none"): R | null => {
  if (typeof window === "undefined") {
    return null;
  }

  if (scope === "none") {
    return jsonParseSafe<R>(localStorage.getItem(key));
  }

  if (scope === "report") {
    return jsonParseSafe<R>(restoreWithReportScope(key));
  }

  return null;
};
