import { errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type ReportTestResult } from "types";

import { type StoreSignalState } from "./types";

export type TestResultsStoreState = Record<string, ReportTestResult>;

export type TestResultNavStoreState = string[];

export const testResultStore = signal<StoreSignalState<TestResultsStoreState>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const testResultNavStore = signal<StoreSignalState<TestResultNavStoreState>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchTestResultNav = async () => {
  try {
    const data = await fetchReportJsonData<string[]>("widgets/nav.json", { bustCache: true });

    testResultNavStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    testResultNavStore.value = {
      ...testResultNavStore.value,
      error: errorMessageFromUnknown(err),
      loading: false,
    };
  }
};

let latestTestResultRequest = 0;

export const fetchTestResult = async (testResultId: string) => {
  if (!testResultId) {
    return;
  }

  const requestId = ++latestTestResultRequest;

  testResultStore.value = {
    ...testResultStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<ReportTestResult>(`data/test-results/${testResultId}.json`);
    if (requestId !== latestTestResultRequest) {
      return;
    }

    testResultStore.value = {
      data: { ...testResultStore.value.data, [testResultId]: data },
      error: undefined,
      loading: false,
    };
  } catch (err) {
    if (requestId !== latestTestResultRequest) {
      return;
    }

    testResultStore.value = {
      ...testResultStore.value,
      error: errorMessageFromUnknown(err),
      loading: false,
    };
  }
};
