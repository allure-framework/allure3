import { describe, expect, it } from "vite-plus/test";

import type { TimelineChartData } from "./types";
import { stringToNanoIdWithSalt, toTimelineData } from "./utils";

describe("toTimelineData", () => {
  it("keeps retry attempts with the same canonical retryHash as separate timeline segments", () => {
    const timelineData: TimelineChartData = [
      {
        id: "old-attempt",
        name: "old attempt",
        status: "failed",
        flaky: false,
        isRetry: true,
        start: 100,
        duration: 10,
        retryHash: "retry-hash",
        host: "host",
        thread: "thread",
      },
      {
        id: "latest-attempt",
        name: "latest attempt",
        status: "passed",
        flaky: false,
        isRetry: false,
        start: 200,
        duration: 10,
        retryHash: "retry-hash",
        host: "host",
        thread: "thread",
      },
    ];

    const groups = toTimelineData(timelineData, "timeline");

    expect(groups).toHaveLength(1);
    expect(groups[0].segments).toEqual([
      expect.objectContaining({
        id: "old-attempt",
        label: "old attempt",
        testResultId: "old-attempt",
        isRetry: true,
      }),
      expect.objectContaining({
        id: "latest-attempt",
        label: "latest attempt",
        testResultId: "latest-attempt",
        isRetry: false,
      }),
    ]);
  });

  it("puts each thread of a host into its own group", () => {
    const threads = ["pid-2999-worker-0", "pid-2999-worker-1", "pid-2999-worker-2"];
    const timelineData: TimelineChartData = threads.map((thread, index) => ({
      id: `test-${index}`,
      name: `test ${index}`,
      status: "passed",
      flaky: false,
      isRetry: false,
      start: 100,
      duration: 10,
      retryHash: `retry-hash-${index}`,
      host: "ci-runner",
      thread,
    }));

    const groups = toTimelineData(timelineData, "ci-runner");

    expect(groups.map(({ name }) => name)).toEqual(threads);
    expect(groups.map(({ segments }) => segments.map(({ id }) => id))).toEqual([["test-0"], ["test-1"], ["test-2"]]);
  });
});

describe("stringToNanoIdWithSalt", () => {
  it("returns the same id for the same input and salt", () => {
    expect(stringToNanoIdWithSalt("thread", "salt")).toBe(stringToNanoIdWithSalt("thread", "salt"));
  });

  it("does not collapse different inputs into a small set of ids", () => {
    const ids = new Set<string>();

    for (let pid = 1000; pid < 2000; pid++) {
      for (let worker = 0; worker < 3; worker++) {
        ids.add(stringToNanoIdWithSalt(`pid-${pid}-worker-${worker}`, "salt"));
      }
    }

    expect(ids.size).toBe(3000);
  });
});
