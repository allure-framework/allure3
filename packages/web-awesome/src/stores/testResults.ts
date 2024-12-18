import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type AllureAwesomeTestResult } from "../../types";
import { type StoreSignalState } from "./types";

export const testResultStore = signal<StoreSignalState<Record<string, AllureAwesomeTestResult>>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchTestResult = async (testResultId: string) => {
  if (!testResultId || testResultStore.value.data?.[testResultId]) {
    return;
  }

  testResultStore.value = {
    ...testResultStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<AllureAwesomeTestResult>(`data/test-results/${testResultId}.json`);

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
