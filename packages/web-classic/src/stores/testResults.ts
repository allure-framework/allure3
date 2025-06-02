import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type AwesomeTestResult } from "types";
import { type StoreSignalState } from "./types";

export type TestResultsStoreState = Record<string, AwesomeTestResult>;

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
      error: err.message,
      loading: false,
    };
  }
};

export const fetchTestResult = async (testResultId: string) => {
  if (!testResultId) {
    return;
  }

  testResultStore.value = {
    ...testResultStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<AwesomeTestResult>(`data/test-results/${testResultId}.json`);

    testResultStore.value = {
      data: { ...testResultStore.value.data, [testResultId]: data },
      error: undefined,
      loading: false,
    };
  } catch (err) {
    testResultStore.value = {
      ...testResultStore.value,
      error: err.message,
      loading: false,
    };
  }
};
