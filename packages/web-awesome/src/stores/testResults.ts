import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type AwesomeTestResult } from "../../types";
import { type StoreSignalState } from "./types";

export type TrStoreState = Record<string, AwesomeTestResult>;

export type TrNavStoreState = string[];

export const testResultStore = signal<StoreSignalState<TrStoreState>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const testResultNavStore = signal<StoreSignalState<TrNavStoreState>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchTestResultNav = async (env?: string) => {
  try {
    const data = await fetchReportJsonData<string[]>(env ? `widgets/${env}/nav.json` : "widgets/nav.json", {
      bustCache: true,
    });

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
  if (!testResultId || (testResultStore.value.data && testResultId in testResultStore.value.data)) {
    return;
  }

  testResultStore.value = {
    ...testResultStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<AwesomeTestResult>(`data/test-results/${testResultId}.json`, {
      bustCache: true,
    });

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
