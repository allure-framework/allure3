import type { TestResult } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { StoreSignalState } from "@/stores/types";

export type TimlineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "flaky" | "hidden" | "environment" | "start" | "duration"
> & {
  host: string;
  thread: string;
};

export const timelineStore = signal<StoreSignalState<TimlineTr[]>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchTimelineData = async () => {
  timelineStore.value = {
    ...timelineStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TimlineTr[]>("widgets/timeline.json", { bustCache: true });

    timelineStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    timelineStore.value = {
      data: undefined,
      error: err.message,
      loading: false,
    };
  }
};
