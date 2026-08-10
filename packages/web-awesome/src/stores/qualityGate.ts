import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { AwesomeQualityGateResults } from "types";

import { type StoreSignalState } from "./types";

export const qualityGateStore = signal<StoreSignalState<AwesomeQualityGateResults>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchQualityGateResults = async () => {
  try {
    const data = await fetchReportJsonData<AwesomeQualityGateResults>("widgets/quality-gate.json");

    qualityGateStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    qualityGateStore.value = {
      ...qualityGateStore.peek(),
      error: err.message,
      loading: false,
    };
  }
};
