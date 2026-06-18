import { describe, expect, it } from "vitest";

import { latestMetricSamples, metricRows } from "../src/stores/metrics";

describe("metrics store helpers", () => {
  it("keeps the latest current sample per metric key", () => {
    expect(
      latestMetricSamples([
        { key: "b", value: 1 },
        { key: "a", value: 2 },
        { key: "b", value: 3 },
      ]),
    ).toEqual([
      { key: "a", value: 2 },
      { key: "b", value: 3 },
    ]);
  });

  it("builds metric rows with nearest previous values, deltas, and trends", () => {
    expect(
      metricRows({
        current: [
          { key: "generate.total.avgMs", value: 120, unit: "ms" },
          { key: "browser.heap.usedMb", value: 48, unit: "MB" },
        ],
        history: [
          {
            uuid: "2",
            name: "latest",
            timestamp: 2,
            url: "",
            metrics: {
              "generate.total.avgMs": 200,
            },
          },
          {
            uuid: "1",
            name: "oldest",
            timestamp: 1,
            url: "",
            metrics: {
              "generate.total.avgMs": 300,
              "browser.heap.usedMb": 50,
            },
          },
        ],
      }),
    ).toEqual([
      {
        key: "browser.heap.usedMb",
        value: 48,
        unit: "MB",
        previousValue: 50,
        delta: -2,
        trend: [50, 48],
      },
      {
        key: "generate.total.avgMs",
        value: 120,
        unit: "ms",
        previousValue: 200,
        delta: -80,
        trend: [300, 200, 120],
      },
    ]);
  });
});
