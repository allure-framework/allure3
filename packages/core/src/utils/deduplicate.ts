import type { HistoryDataPoint, TestLabel } from "@allurereport/core-api";

/**
 * Deduplicates equal strings so that every copy points at a single instance.
 *
 * Strings produced by separate `JSON.parse` calls are separate heap objects even when their
 * content is equal. Test results repeat the same step names, parameter names and values, and
 * history points repeat the same labels run after run, so a large report holds many copies of
 * each. Routing them through a pool keeps one copy; values stay equal, only identity changes.
 */
export class StringPool {
  #strings = new Map<string, string>();

  deduplicate<T>(value: T): T {
    if (typeof value !== "string") {
      return value;
    }

    const existing = this.#strings.get(value);

    if (existing !== undefined) {
      return existing as T;
    }

    this.#strings.set(value, value);

    return value;
  }

  clear() {
    this.#strings.clear();
  }
}

// `message` and `trace` are not in the HistoryTestResult type, but that is where the history
// writer puts them (see createHistoryItems in ../history.ts).
const historyTestResultStringFields = [
  "id",
  "name",
  "fullName",
  "environment",
  "status",
  "message",
  "trace",
  "url",
  "historyId",
] as const;

const deduplicateStringFields = (
  stringPool: StringPool,
  target: Record<string, unknown>,
  fieldNames: readonly string[],
) => {
  for (const field of fieldNames) {
    if (typeof target[field] === "string") {
      target[field] = stringPool.deduplicate(target[field]);
    }
  }
};

/**
 * Deduplicates strings and label objects of history data points in place.
 *
 * History points are parsed one line at a time, so the same test's labels, names and ids are
 * separate objects in every point. Items are shared with the history provider's own cache, so
 * they are updated in place rather than copied; frozen items are left as they are.
 * Label objects are shared between points, which is safe because history items are read-only
 * once loaded: everything that needs a different item copies it first.
 */
export const deduplicateHistoryDataPoints = (historyDataPoints: HistoryDataPoint[]) => {
  const stringPool = new StringPool();
  const labelsByNameAndValue = new Map<string, TestLabel>();
  const deduplicateLabel = (label: TestLabel): TestLabel => {
    if (!label || typeof label !== "object") {
      return label;
    }

    if (!Object.isFrozen(label)) {
      deduplicateStringFields(stringPool, label as unknown as Record<string, unknown>, ["name", "value"]);
    }

    // only plain { name, value } string pairs are shared; anything else keeps its own object
    const keys = Object.keys(label);
    const shareable =
      keys.length === 2 &&
      keys.includes("name") &&
      keys.includes("value") &&
      typeof label.name === "string" &&
      typeof label.value === "string";

    if (!shareable) {
      return label;
    }

    const labelKey = `${label.name}\u0000${label.value}`;
    const existing = labelsByNameAndValue.get(labelKey);

    if (existing) {
      return existing;
    }

    labelsByNameAndValue.set(labelKey, label);

    return label;
  };

  for (const historyDataPoint of historyDataPoints) {
    const { knownTestCaseIds, testResults } = historyDataPoint;

    if (Array.isArray(knownTestCaseIds) && !Object.isFrozen(knownTestCaseIds)) {
      for (let i = 0; i < knownTestCaseIds.length; i++) {
        knownTestCaseIds[i] = stringPool.deduplicate(knownTestCaseIds[i]);
      }
    }

    for (const historyTestResult of Object.values(testResults ?? {})) {
      if (!historyTestResult || typeof historyTestResult !== "object" || Object.isFrozen(historyTestResult)) {
        continue;
      }

      const historyTestResultFields = historyTestResult as unknown as Record<string, unknown>;

      deduplicateStringFields(stringPool, historyTestResultFields, historyTestResultStringFields);

      const error = historyTestResult.error as Record<string, unknown> | undefined;

      if (error && typeof error === "object" && !Object.isFrozen(error)) {
        deduplicateStringFields(stringPool, error, ["message", "trace"]);
      }

      const historyLabels = historyTestResult.labels;

      if (Array.isArray(historyLabels) && !Object.isFrozen(historyLabels)) {
        for (let i = 0; i < historyLabels.length; i++) {
          historyLabels[i] = deduplicateLabel(historyLabels[i]);
        }
      }
    }
  }
};
