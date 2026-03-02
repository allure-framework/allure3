import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export type SummaryData = {
  statistic?: { total?: number; passed?: number; failed?: number; broken?: number; skipped?: number; unknown?: number };
  duration?: number;
  flakyCount?: number;
  retriesCount?: number;
};

export const summaryStore = signal<StoreSignalState<SummaryData>>({
  loading: false,
  error: undefined,
  data: undefined,
});

export const fetchSummaryData = async () => {
  summaryStore.value = { ...summaryStore.value, loading: true, error: undefined };
  try {
    const data = await fetchReportJsonData<SummaryData>("widgets/summary.json", { bustCache: true });
    summaryStore.value = { data, error: undefined, loading: false };
  } catch (err) {
    summaryStore.value = { ...summaryStore.value, error: (err as Error).message, loading: false };
  }
};
