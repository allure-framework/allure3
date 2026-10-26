import type { TestResult } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export type TimelineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "flaky" | "isRetry" | "environment" | "start" | "duration" | "retryHash"
> & {
  host: string;
  thread: string;
};

export type TimelineHostGroup = {
  host: string;
  data: TimelineTr[];
};

export const timelineStore = signal<StoreSignalState<TimelineTr[]>>({
  loading: true,
  error: undefined,
  data: undefined,
});

/**
 * Splits timeline items by host, keeping the order in which hosts first appear.
 * Threads inside every host are grouped by the shared Timeline component.
 */
export const groupTimelineByHost = (tests: TimelineTr[] = []): TimelineHostGroup[] => {
  const groups = new Map<string, TimelineTr[]>();

  for (const test of tests) {
    const hostTests = groups.get(test.host);

    if (hostTests) {
      hostTests.push(test);
    } else {
      groups.set(test.host, [test]);
    }
  }

  return Array.from(groups, ([host, data]) => ({ host, data }));
};

export const fetchTimelineData = async () => {
  timelineStore.value = {
    ...timelineStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TimelineTr[]>("widgets/timeline.json", { bustCache: true });

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
