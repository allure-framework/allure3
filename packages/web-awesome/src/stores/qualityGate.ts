import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type StoreSignalState } from "./types";

export const qualityGateStore = signal<StoreSignalState<QualityGateValidationResult[]>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchQualityGateResults = async () => {
  try {
    const data = await fetchReportJsonData<QualityGateValidationResult[]>("widgets/quality-gate.json");

    qualityGateStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    qualityGateStore.value = {
      ...qualityGateStore.peek(),
      error: msg,
      loading: false,
    };
  }
};
