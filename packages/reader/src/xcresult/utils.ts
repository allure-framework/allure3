import type {
  RawStep,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
} from "@allurereport/reader-api";
import { randomUUID } from "node:crypto";
import { isDefined, isNumber } from "../validation.js";
import type { Unknown } from "../validation.js";
import type {
  AllureApiCall,
  LabelsInputData,
  TargetDescriptor,
  TestRunArgs,
  TestRunCoordinates,
  TestRunLookup,
  TestRunSelector,
} from "./model.js";

export const MS_IN_S = 1_000;
export const ALLURE_API_ACTIVITY_PREFIX = "allure.";

export const statusPriorities = new Map<RawTestStatus, number>([
  ["failed", 0],
  ["broken", 1],
  ["unknown", 2],
  ["skipped", 3],
  ["passed", 4],
]);

export const getWorstStatus = (steps: readonly RawStep[]): RawTestStatus | undefined => {
  const statuses = steps.filter((s): s is RawTestStepResult => "status" in s).map(({ status }) => status ?? "unknown");
  return statuses.sort((a, b) => statusPriorities.get(a)! - statusPriorities.get(b)!)[0];
};

export const DEFAULT_BUNDLE_NAME = "The test bundle name is not defined";
export const DEFAULT_SUITE_NAME = "The test suite name is not defined";
export const DEFAULT_TEST_NAME = "The test name is not defined";
export const DEFAULT_STEP_NAME = "The test name is not defined";
export const DEFAULT_ATTACHMENT_NAME = "Attachment";
export const DEFAULT_EXPECTED_FAILURE_REASON = "Expected failure";

export const SURROGATE_DEVICE_ID = randomUUID();
export const SURROGATE_TEST_PLAN_ID = randomUUID();
export const SURROGATE_ARGS_ID = randomUUID();

export const getArgsKeyByValues = (values: readonly (string | undefined)[]) => values.map(String).join(",");

export const getArgsKey = (args: TestRunArgs) => getArgsKeyByValues(args.map((arg) => arg?.value));

export const createTestRunLookup = <T>(entries: readonly (readonly [TestRunCoordinates, T])[]): TestRunLookup<T> =>
  groupByMap(
    entries,
    ([{ device }]) => device ?? SURROGATE_DEVICE_ID,
    (deviceRuns) =>
      groupByMap(
        deviceRuns,
        ([{ testPlan }]) => testPlan ?? SURROGATE_TEST_PLAN_ID,
        (configRuns) =>
          groupByMap(
            configRuns,
            ([{ args }]) => (args && args.length ? getArgsKey(args) : SURROGATE_ARGS_ID),
            (argRuns) => {
              // Make sure retries are ordered by the repetition index
              argRuns.sort(([{ attempt: attemptA }], [{ attempt: attemptB }]) => (attemptA ?? 0) - (attemptB ?? 0));
              return argRuns.map(([, data]) => data);
            },
          ),
      ),
  );

export const lookupTestAttempts = <T>(lookup: TestRunLookup<T>, { args, device, testPlan }: TestRunSelector) =>
  lookup
    .get(device ?? SURROGATE_DEVICE_ID)
    ?.get(testPlan ?? SURROGATE_TEST_PLAN_ID)
    ?.get(args ? getArgsKeyByValues(args) : SURROGATE_ARGS_ID);

export const lookupTestAttempt = <Data>(lookup: TestRunLookup<Data>, selector: TestRunSelector) => {
  const attempts = lookupTestAttempts(lookup, selector);
  const { attempt = 0 } = selector;
  return attempts?.[attempt];
};

export const lookupNextTestAttempt = <Data>(
  lookup: TestRunLookup<Data>,
  selector: TestRunSelector,
  pred: (data: Data) => boolean,
) => {
  const attempts = lookupTestAttempts(lookup, selector);
  return attempts?.find(pred);
};

export const groupBy = <T, K>(values: readonly T[], keyFn: (v: T) => K): Map<K, T[]> =>
  values.reduce((m, v) => {
    const key = keyFn(v);
    if (!m.get(key)?.push(v)) {
      m.set(key, [v]);
    }
    return m;
  }, new Map<K, T[]>());

export const groupByMap = <T, K, G>(
  values: readonly T[],
  keyFn: (v: T) => K,
  groupMapFn: (group: T[]) => G,
): Map<K, G> =>
  new Map<K, G>(
    groupBy(values, keyFn)
      .entries()
      .map(([k, g]) => [k, groupMapFn(g)]),
  );

export const getTargetDetails = ({ architecture, model, platform, osVersion }: TargetDescriptor = {}) => {
  const osPart = platform ? (osVersion ? `${platform} ${osVersion}` : platform) : undefined;

  return [model, architecture, osPart].filter(isDefined).join(", ") || undefined; // coerce empty string to undefined
};

export const compareByStart = ({ start: startA }: RawStep, { start: startB }: RawStep) => (startA ?? 0) - (startB ?? 0);

export const toSortedSteps = (...stepArrays: readonly (readonly RawStep[])[]) => {
  const allSteps = stepArrays.reduce<RawStep[]>((result, steps) => {
    result.push(...steps);
    return result;
  }, []);
  allSteps.sort(compareByStart);
  return allSteps;
};

export const secondsToMilliseconds = (seconds: Unknown<number>) =>
  isNumber(seconds) ? Math.round(MS_IN_S * seconds) : undefined;

export const parseAsAllureApiActivity = (title: string | undefined): AllureApiCall | undefined => {
  if (isPotentialAllureApiActivity(title)) {
    const maybeApiCall = title.slice(ALLURE_API_ACTIVITY_PREFIX.length);
    const apiValueSeparatorIndex = indexOfAny(maybeApiCall, ":", "=");
    if (apiValueSeparatorIndex !== -1) {
      const apiCall = maybeApiCall.slice(0, apiValueSeparatorIndex).trim();
      const value = maybeApiCall.slice(apiValueSeparatorIndex + 1);
      switch (apiCall) {
        case "id":
          return { type: "label", value: { name: "ALLURE_ID", value } };
        case "name":
          return { type: "name", value };
        case "description":
          return { type: "description", value };
        case "precondition":
          return { type: "precondition", value };
        case "expectedResult":
          return { type: "expectedResult", value };
        case "flaky":
          return { type: "flaky", value: parseBooleanApiArg(value) };
        case "muted":
          return { type: "muted", value: parseBooleanApiArg(value) };
        case "known":
          return { type: "known", value: parseBooleanApiArg(value) };
        default:
          return parseComplexAllureApiCall(apiCall, value);
      }
    }
  }
};

export const applyApiCalls = (testResult: RawTestResult, apiCalls: readonly AllureApiCall[]) =>
  groupByMap(
    apiCalls,
    (v) => v.type,
    (g) => g.map(({ value }) => value),
  )
    .entries()
    .forEach(([type, values]) => applyApiCallGroup(testResult, type, values));

const applyApiCallGroup = (
  testResult: RawTestResult,
  type: AllureApiCall["type"],
  values: readonly AllureApiCall["value"][],
) => {
  switch (type) {
    case "name":
      testResult.name = values.at(-1) as string;
      break;
    case "flaky":
      testResult.flaky = values.at(-1) as boolean;
      break;
    case "muted":
      testResult.muted = values.at(-1) as boolean;
      break;
    case "known":
      testResult.known = values.at(-1) as boolean;
      break;
    case "description":
      testResult.description = mergeMarkdownBlocks(testResult.description, ...(values as string[]));
      break;
    case "precondition":
      testResult.precondition = mergeMarkdownBlocks(testResult.precondition, ...(values as string[]));
      break;
    case "expectedResult":
      testResult.expectedResult = mergeMarkdownBlocks(testResult.expectedResult, ...(values as string[]));
      break;
    case "label":
      testResult.labels = [...(testResult.labels ?? []), ...(values as RawTestLabel[])];
      break;
    case "link":
      testResult.links = [...(testResult.links ?? []), ...(values as RawTestLink[])];
      break;
    case "parameter":
      testResult.parameters = [...(testResult.parameters ?? []), ...(values as RawTestParameter[])];
      break;
  }
};

export const createTestLabels = ({
  hostName,
  projectName,
  bundle,
  suites,
  className,
  functionName,
  tags,
}: LabelsInputData) => {
  const labels: RawTestLabel[] = [];

  if (hostName) {
    labels.push({ name: "host", value: hostName });
  }

  const packageName = [projectName, bundle].filter(isDefined).join(".");
  if (packageName) {
    labels.push({ name: "package", value: packageName });
  }
  if (className) {
    labels.push({ name: "testClass", value: className });
  }
  if (functionName) {
    labels.push({ name: "testMethod", value: functionName });
  }

  if (bundle) {
    labels.push({ name: "parentSuite", value: bundle });
  }

  const [suite, ...subSuites] = suites;

  if (suite) {
    labels.push({ name: "suite", value: suite });
  }

  const subSuite = subSuites.join(" > ");
  if (subSuite) {
    labels.push({ name: "subSuite", value: subSuite });
  }

  labels.push(...tags.map((value) => ({ name: "tag", value })));

  return labels;
};

const mergeMarkdownBlocks = (...blocks: readonly (string | undefined)[]) =>
  blocks.filter(isDefined).reduce((a, b) => `${a}\n\n${b}`);

const isPotentialAllureApiActivity = (title: string | undefined): title is `allure.${string}` =>
  isDefined(title) && title.startsWith(ALLURE_API_ACTIVITY_PREFIX);

const parseComplexAllureApiCall = (apiCall: string, value: string): AllureApiCall | undefined => {
  const apiFnEnd = apiCall.indexOf(".");
  if (apiFnEnd !== -1) {
    const apiFn = apiCall.slice(0, apiFnEnd);
    const { primary: primaryOption, secondary: secondaryOptions } = parseAllureApiCallOptions(
      apiCall.slice(apiFnEnd + 1),
    );
    switch (apiFn) {
      case "label":
        return parseAllureLabelApiCall(primaryOption, value);
      case "link":
        return parseAllureLinkApiCall(primaryOption, secondaryOptions, value);
      case "parameter":
        return parseAllureParameterApiCall(primaryOption, secondaryOptions, value);
    }
  }
};

const parseAllureLabelApiCall = (name: string, value: string): AllureApiCall | undefined =>
  name ? { type: "label", value: { name, value } } : undefined;

const parseAllureLinkApiCall = (name: string, [type]: string[], url: string): AllureApiCall | undefined => {
  return { type: "link", value: { name, type, url } };
};

const parseAllureParameterApiCall = (name: string, options: string[], value: string): AllureApiCall | undefined => {
  const parameter: RawTestParameter = { name, value };
  options.forEach((option) => {
    switch (option.toLowerCase()) {
      case "hidden":
        parameter.hidden = true;
        break;
      case "excluded":
        parameter.excluded = true;
        break;
      case "masked":
        parameter.masked = true;
        break;
    }
  });
  return { type: "parameter", value: parameter };
};

const parseAllureApiCallOptions = (options: string): { primary: string; secondary: string[] } => {
  const primaryEnd = options.indexOf("[");
  if (primaryEnd !== -1) {
    const primary = decodeURIComponentSafe(options.slice(0, primaryEnd));
    const secondaryEnd = options.indexOf("]");
    if (secondaryEnd === options.length) {
      return {
        primary,
        secondary: options
          .slice(primaryEnd + 1, -1)
          .split(",")
          .map((v) => decodeURIComponentSafe(v.trim())),
      };
    }
    return { primary, secondary: [] };
  }
  return { primary: decodeURIComponentSafe(options), secondary: [] };
};

const indexOfAny = (input: string, ...searchStrings: readonly string[]) =>
  searchStrings.reduce((a, e) => {
    const indexOfE = input.indexOf(e);
    return a === -1 ? indexOfE : Math.min(a, indexOfE);
  }, 0);

const parseBooleanApiArg = (value: string) => !value || value.toLowerCase() === "true";

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
