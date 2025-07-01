import type { HistoryDataPoint, HistoryTestResult } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import { faker } from "@faker-js/faker";
import { Stage, Status, type TestResult } from "allure-js-commons";
import _times from "lodash.times";
import type { ReportConfig } from "../../types.js";

export type ItemMaker<T> = (index: number, params: T) => Partial<T>;

export const MIN_DURATION = 1000;
export const MAX_DURATION = 10000;

/**
 * Generates a random UUID using faker
 */
export const generateUuid = () => faker.string.uuid();

/**
 * Generates a random word using faker
 */
export const generateWord = () => faker.lorem.word();

/**
 * Generates a unique name by combining a prefix and a random word
 * @param prefix - Prefix for the name
 * @returns Unique name
 */
export const generateUniqueName = (prefix: string) => `${prefix}: ${generateWord()}`;

/**
 * Generates a random recent date timestamp
 */
export const generateDate = () => faker.date.recent().getTime();

/**
 * Generates a random integer between min and max
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 */
export const generateNumber = (min: number, max: number) => faker.number.int({ min, max });

/**
 * Picks a random element from the provided array
 * @param arr - Array to pick from
 */
export const generateArrayElement = <T>(arr: T[]) => faker.helpers.arrayElement(arr);

/**
 * Generates a random duration between 1 and 10 seconds
 */
export const generateDuration = () => faker.number.int({ min: MIN_DURATION, max: MAX_DURATION });

/**
 * Generates a unique name and full name for a test case
 * @param prefix - Prefix for the name
 * @returns Object containing name and fullName
 */
export const makeTestResultNames = (prefix: string): Pick<TestResult, "name" | "fullName"> => ({
  name: generateUniqueName(prefix),
  fullName: generateUniqueName(`${prefix}: fullName`),
});

/**
 * Generates a test case ID by hashing the full name
 * @param fullName - Full name of the test case
 */
export const makeTestCaseId = (fullName: string) => md5(fullName);

/**
 * Generates a history ID by combining test case ID and parameters hash
 * @param fullName - Full name of the test case
 * @param strParameters - Optional string parameters
 */
export const makeHistoryId = (fullName: string, strParameters = "") => {
  const testCaseId = makeTestCaseId(fullName);
  const parametersMd5 = md5(strParameters);

  return `${testCaseId}.${parametersMd5}`;
};

/**
 * Generates a TestResult with random data
 * @param params - Partial TestResult to override default values
 */
export const makeTestResult = (params?: Partial<TestResult>): TestResult => {
  const start = generateDate();
  const stop = start + generateDuration();
  const {
    uuid = generateUuid(),
    name = generateWord(),
    fullName = generateWord(),
    status = generateArrayElement(Object.values(Status)),
    statusDetails = {},
    labels = [],
    links = [],
    parameters = [],
    steps = [],
    attachments = [],
    stage = generateArrayElement(Object.values(Stage)),
    ...rest
  } = params || {};

  return {
    uuid,
    name,
    fullName,
    status,
    statusDetails,
    labels,
    links,
    parameters,
    steps,
    attachments,
    stage,
    start,
    stop,
    ...rest,
  };
};

/**
 * Generates an array of TestResults with sequential timestamps
 * @param count - Number of test results to generate
 * @param maker - Function to customize each test result
 */
export const makeTestResults = (count: number, maker: ItemMaker<TestResult>): TestResult[] => {
  const now = generateDate();
  const duration = generateDuration();

  return _times(count, (index) => {
    const start = now - index * duration;
    const stop = start + duration;
    const testResult = makeTestResult({ start, stop });

    return Object.assign(testResult, maker(index, testResult));
  });
};

/**
 * Generates a history item with random data
 * @param params - Additional parameters to override defaults
 */
export const makeHistoryItem = (
  params?: Partial<HistoryDataPoint>,
): HistoryDataPoint => {
  const {
    uuid = generateUuid(),
    name = generateWord(),
    timestamp = generateDate(),
    metrics = {},
    knownTestCaseIds = [],
    testResults = {},
    url = "",
    ...rest
  } = params || {};

  return {
    uuid,
    name,
    timestamp,
    knownTestCaseIds,
    testResults,
    metrics,
    url,
    ...rest,
  };
};

/**
 * Generates an array of history items
 * @param count - Number of history items to generate
 * @param maker - Function to customize each history item
 */
export const makeHistory = (
  count: number,
  maker: ItemMaker<HistoryDataPoint>,
): HistoryDataPoint[] => {
  const now = generateDate();

  return _times(count, (index) => {
    // Timestamp is decreasing to reflect the most recent to the oldest history items
    const timestamp = now - index * MAX_DURATION; // MAX_DURATION is used to not overlap with previous history items
    const historyItem = makeHistoryItem({ timestamp });

    return Object.assign(historyItem, maker(index, historyItem));
  });
};

export const makeHistoryTestResult = (testResult: TestResult): HistoryTestResult => {
  return {
    id: testResult.uuid,
    name: testResult.name,
    fullName: testResult.fullName,
    status: testResult.status,
    start: testResult.start,
    stop: testResult.stop,
    duration: testResult.stop && testResult.start ? testResult.stop - testResult.start : undefined,
    labels: testResult.labels || [],
    url: "",
    ...testResult,
  };
};

/**
 * Converts an array of HistoryTestResults into a map keyed by history ID
 * @param testResults - Array of test results to convert
 */
export const makeHistoryTestResults = (testResults: TestResult[] = []): Record<string, HistoryTestResult> => {
  const map: Record<string, HistoryTestResult> = {};

  testResults.forEach((tr) => {
    const historyId = tr.historyId || makeHistoryId(tr.fullName);

    map[historyId] = makeHistoryTestResult(tr);
  });

  return map;
};

/**
 * Generates a report configuration with random data
 * @param params - Additional parameters to override defaults
 */
export const makeReportConfig = (params?: Partial<ReportConfig>): ReportConfig => {
  const {
    name = generateWord(),
    appendHistory = true,
    knownIssuesPath = undefined,
    ...rest
  } = params || {};

  return {
    name,
    appendHistory,
    knownIssuesPath,
    ...rest,
  };
};
