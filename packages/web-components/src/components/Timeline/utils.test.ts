import { scaleUtc } from "d3-scale";
import { describe, expect, it } from "vite-plus/test";

import type { TimelineChartData } from "./types";
import { fitTimeTicks, toTimelineData } from "./utils";

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

describe("fitTimeTicks", () => {
  // 18 seconds on a 554px axis: d3 asks for 1s ticks at counts 7..10, which gives 19 overlapping labels
  const scale = scaleUtc()
    .domain([new Date(1_000), new Date(19_000)])
    .range([0, 554]);

  it("keeps the default ticks when no spacing is set", () => {
    expect(fitTimeTicks(scale, 7)).toBeNull();
    expect(fitTimeTicks(scale, 7, 0)).toBeNull();
  });

  it("drops ticks until labels are at least the given distance apart", () => {
    expect(scale.ticks(10)).toHaveLength(19);

    const ticks = fitTimeTicks(scale, 10, 80)!;
    const positions = ticks.map((tick) => scale(tick));

    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(Math.floor(554 / 80) + 1);
    positions.slice(1).forEach((position, index) => {
      expect(position - positions[index]).toBeGreaterThanOrEqual(80);
    });
  });

  it("keeps the preferred count when the ticks already fit", () => {
    const wide = scale.copy().range([0, 2000]);

    expect(fitTimeTicks(wide, 7, 80)).toEqual(wide.ticks(7));
  });
});
