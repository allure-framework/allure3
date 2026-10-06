import { describe, expect, it } from "vitest";

import type { TimelineChartData } from "./types";
import { toTimelineData } from "./utils";

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
});
