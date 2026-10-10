import type {
  HistoryDataPoint,
  TestCase,
  TestError,
  TestFixtureResult,
  TestLabel,
  TestLink,
  TestParameter,
  TestResult,
  TestStepResult,
} from "@allurereport/core-api";

/**
 * Deduplicates equal strings so that every copy points at a single instance.
 *
 * Strings produced by separate `JSON.parse` calls are separate heap objects even when their
 * content is equal. Test results repeat the same step names, parameter values and labels, and
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
// writer puts them (see createHistoryItems in ../history.ts); `retries` is written there as an
// array of status strings.
const historyTestResultStringFields = [
  "id",
  "name",
  "fullName",
  "environment",
  "status",
  "message",
  "trace",
  "url",
  "retryHash",
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

const deduplicateStringArray = (stringPool: StringPool, values: unknown[]) => {
  for (let i = 0; i < values.length; i++) {
    if (typeof values[i] === "string") {
      values[i] = stringPool.deduplicate(values[i]);
    }
  }
};

/**
 * Deduplicates strings and label objects of history data points in place.
 *
 * History points are parsed one line at a time, so the same test's labels, names and ids are
 * separate objects in every point. Pass the points as the history provider returned them: it keeps
 * them in its own cache, so they are updated in place rather than copied, and copies made from them
 * afterwards share the same values; frozen items are left as they are.
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
      deduplicateStringArray(stringPool, knownTestCaseIds);
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

      const retries = historyTestResult.retries;

      if (Array.isArray(retries) && !Object.isFrozen(retries)) {
        deduplicateStringArray(stringPool, retries);
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

const testResultStringFields = [
  "id",
  "name",
  "fullName",
  "environment",
  "status",
  "description",
  "descriptionHtml",
  "precondition",
  "preconditionHtml",
  "expectedResult",
  "expectedResultHtml",
  "resolution",
  "resolutionComment",
  "transition",
  "hostId",
  "threadId",
  "runSelector",
  "retryHash",
  "testCaseHash",
  "parametersHash",
  "environmentHash",
] as const;

const fixtureResultStringFields = ["id", "type", "name", "status"] as const;
const errorStringFields = ["message", "trace", "actual", "expected"] as const;
const labelStringFields = ["name", "value"] as const;
const parameterStringFields = ["name", "value"] as const;
const linkStringFields = ["name", "url", "type"] as const;
const testCaseStringFields = ["id", "allureId", "externalId", "name", "fullName"] as const;
const stepStringFields = ["stepId", "name", "status", "message", "trace"] as const;
const attachmentLinkStringFields = ["id", "name", "originalFileName", "ext", "contentType"] as const;

const deduplicateError = (stringPool: StringPool, error: TestError | undefined) => {
  if (!error || typeof error !== "object" || Object.isFrozen(error)) {
    return;
  }

  deduplicateStringFields(stringPool, error as unknown as Record<string, unknown>, errorStringFields);
};

const deduplicateLabels = (stringPool: StringPool, labels: TestLabel[] | undefined) => {
  if (!Array.isArray(labels) || Object.isFrozen(labels)) {
    return;
  }

  for (const label of labels) {
    if (!label || typeof label !== "object" || Object.isFrozen(label)) {
      continue;
    }

    deduplicateStringFields(stringPool, label as unknown as Record<string, unknown>, labelStringFields);
  }
};

const deduplicateParameters = (stringPool: StringPool, parameters: TestParameter[] | undefined) => {
  if (!Array.isArray(parameters) || Object.isFrozen(parameters)) {
    return;
  }

  for (const parameter of parameters) {
    if (!parameter || typeof parameter !== "object" || Object.isFrozen(parameter)) {
      continue;
    }

    deduplicateStringFields(stringPool, parameter as unknown as Record<string, unknown>, parameterStringFields);
  }
};

const deduplicateLinks = (stringPool: StringPool, links: TestLink[] | undefined) => {
  if (!Array.isArray(links) || Object.isFrozen(links)) {
    return;
  }

  for (const link of links) {
    if (!link || typeof link !== "object" || Object.isFrozen(link)) {
      continue;
    }

    deduplicateStringFields(stringPool, link as unknown as Record<string, unknown>, linkStringFields);
  }
};

const deduplicateSteps = (stringPool: StringPool, steps: TestStepResult[] | undefined): void => {
  if (!Array.isArray(steps) || Object.isFrozen(steps)) {
    return;
  }

  for (const step of steps) {
    if (!step || typeof step !== "object" || Object.isFrozen(step)) {
      continue;
    }

    if (step.type === "attachment") {
      const link = step.link;

      if (link && typeof link === "object" && !Object.isFrozen(link)) {
        deduplicateStringFields(stringPool, link as unknown as Record<string, unknown>, attachmentLinkStringFields);
      }

      continue;
    }

    deduplicateStringFields(stringPool, step as unknown as Record<string, unknown>, stepStringFields);
    deduplicateError(stringPool, step.error);
    deduplicateParameters(stringPool, step.parameters);
    deduplicateSteps(stringPool, step.steps);
  }
};

const deduplicateTestCase = (stringPool: StringPool, testCase: TestCase | undefined) => {
  if (!testCase || typeof testCase !== "object" || Object.isFrozen(testCase)) {
    return;
  }

  deduplicateStringFields(stringPool, testCase as unknown as Record<string, unknown>, testCaseStringFields);
};

const deduplicateTestResult = (stringPool: StringPool, testResult: TestResult): void => {
  if (!testResult || typeof testResult !== "object" || Object.isFrozen(testResult)) {
    return;
  }

  deduplicateStringFields(stringPool, testResult as unknown as Record<string, unknown>, testResultStringFields);
  deduplicateError(stringPool, testResult.error);

  for (const error of testResult.errors ?? []) {
    deduplicateError(stringPool, error);
  }

  deduplicateTestCase(stringPool, testResult.testCase);
  deduplicateLabels(stringPool, testResult.labels);
  deduplicateParameters(stringPool, testResult.parameters);
  deduplicateLinks(stringPool, testResult.links);
  deduplicateSteps(stringPool, testResult.steps);

  const titlePath = testResult.titlePath;

  if (Array.isArray(titlePath) && !Object.isFrozen(titlePath)) {
    deduplicateStringArray(stringPool, titlePath);
  }

  for (const retry of testResult.retries ?? []) {
    deduplicateTestResult(stringPool, retry);
  }
};

const deduplicateFixtureResult = (stringPool: StringPool, fixtureResult: TestFixtureResult): void => {
  if (!fixtureResult || typeof fixtureResult !== "object" || Object.isFrozen(fixtureResult)) {
    return;
  }

  deduplicateStringFields(stringPool, fixtureResult as unknown as Record<string, unknown>, fixtureResultStringFields);
  deduplicateError(stringPool, fixtureResult.error);
  deduplicateSteps(stringPool, fixtureResult.steps);

  const testResultIds = fixtureResult.testResultIds;

  if (Array.isArray(testResultIds) && !Object.isFrozen(testResultIds)) {
    deduplicateStringArray(stringPool, testResultIds);
  }
};

/**
 * Deduplicates strings of restored store state in place.
 *
 * Every dump entry is parsed with its own `JSON.parse`, so restored results hold their own copies
 * of the same step names, parameter values and labels, exactly like results that were just read.
 * Routing them through the store's pool makes restored and freshly read results share one copy;
 * values stay equal, only identity changes. Nested steps and retries are walked recursively,
 * while `sourceMetadata` and `categories` are left alone: they hold arbitrary reader data.
 * Frozen objects are left as they are. Pass the state as it comes from `JSON.parse`, before the
 * store indexes or copies any of it.
 */
export const deduplicateStoreState = (
  stringPool: StringPool,
  state: {
    testResults: Record<string, TestResult>;
    fixtures: Record<string, TestFixtureResult>;
    testCases: Record<string, TestCase>;
  },
) => {
  for (const testCase of Object.values(state.testCases)) {
    deduplicateTestCase(stringPool, testCase);
  }

  for (const testResult of Object.values(state.testResults)) {
    deduplicateTestResult(stringPool, testResult);
  }

  for (const fixtureResult of Object.values(state.fixtures)) {
    deduplicateFixtureResult(stringPool, fixtureResult);
  }
};
