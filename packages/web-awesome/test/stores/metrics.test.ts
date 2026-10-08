import { describe, expect, it } from "vitest";

import { metricHistoryRows, metricSummaryRows, metricRows, type MetricsWidgetData } from "@/stores/metrics";

const data: MetricsWidgetData = {
  current: [
    {
      id: "generate-total-avg",
      key: "generate.total.avgMs",
      value: 180,
      start: 100,
      stop: 280,
      unit: "ms",
      source: "generate-total-performance.json",
      better: "lower",
    },
    {
      id: "generate-total-count",
      key: "generate.total.count",
      value: 1,
      start: 100,
      stop: 280,
      unit: "count",
      source: "generate-total-performance.json",
      better: "neutral",
    },
    {
      id: "generate-total-total",
      key: "generate.total.totalMs",
      value: 180,
      start: 100,
      stop: 280,
      unit: "ms",
      source: "generate-total-performance.json",
      better: "lower",
    },
    {
      id: "generate-total-min",
      key: "generate.total.minMs",
      value: 180,
      start: 100,
      stop: 280,
      unit: "ms",
      source: "generate-total-performance.json",
      better: "lower",
    },
    {
      id: "generate-total-max",
      key: "generate.total.maxMs",
      value: 180,
      start: 100,
      stop: 280,
      unit: "ms",
      source: "generate-total-performance.json",
      better: "lower",
    },
    {
      id: "browser-heap",
      key: "browser.heap.usedMb",
      value: 48,
      start: 300,
      stop: 331,
      unit: "MB",
      source: "performance.json",
      better: "lower",
    },
  ],
  history: [
    {
      uuid: "history-2",
      name: "Newer report without heap",
      timestamp: 2000,
      metrics: {
        "generate.total.avgMs": 220,
      },
    },
    {
      uuid: "history-1",
      name: "Older report",
      timestamp: 1000,
      metrics: {
        "generate.total.avgMs": 240,
        "browser.heap.usedMb": 50,
      },
    },
  ],
};

describe("metrics store helpers", () => {
  it("should compute metric rows with nearest available previous value", () => {
    expect(metricRows(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "generate.total.avgMs",
          delta: -40,
          trend: [240, 220, 180],
        }),
        expect.objectContaining({
          key: "browser.heap.usedMb",
          delta: -2,
          trend: [50, 48],
        }),
      ]),
    );
  });

  it("should build one compact summary row per metric key", () => {
    expect(metricSummaryRows(data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "browser.heap.usedMb",
          count: 1,
          totalMs: 48,
          avgMs: 48,
          minMs: 48,
          maxMs: 48,
          group: "browser",
          delta: -2,
          trend: [50, 48],
        }),
        expect.objectContaining({
          key: "generate.total.avgMs",
          count: 1,
          totalMs: 180,
          avgMs: 180,
          minMs: 180,
          maxMs: 180,
          group: "generate",
          delta: -40,
          trend: [240, 220, 180],
        }),
      ]),
    );
  });

  it("should average repeated current samples for summary deltas and trends", () => {
    expect(
      metricSummaryRows({
        current: [
          { id: "avg-1", key: "generate.total.avgMs", value: 220, start: 0, stop: 220 },
          { id: "avg-2", key: "generate.total.avgMs", value: 180, start: 250, stop: 430 },
          { id: "count", key: "generate.total.count", value: 1, start: 0, stop: 430 },
        ],
        history: [
          {
            uuid: "history-1",
            name: "Older report",
            timestamp: 1000,
            metrics: {
              "generate.total.avgMs": 200,
            },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        key: "generate.total.avgMs",
        count: 2,
        avgMs: 200,
        delta: 0,
        trend: [200, 200],
      }),
      expect.objectContaining({
        key: "generate.total.count",
        avgMs: 1,
      }),
    ]);
  });

  it("should prefer explicit metric group for summary rows", () => {
    expect(
      metricSummaryRows({
        current: [
          {
            id: "parser-duration",
            key: "parser.duration.avgMs",
            value: 20,
            start: 0,
            stop: 20,
            unit: "ms",
            group: "backend",
            source: "performance.json",
          },
        ],
        history: [],
      }),
    ).toEqual([
      expect.objectContaining({
        key: "parser.duration.avgMs",
        group: "backend",
        avgMs: 20,
      }),
    ]);
  });

  it("should return sorted drilldown rows for one metric", () => {
    expect(metricHistoryRows(data, "generate.total.avgMs")).toEqual([
      expect.objectContaining({
        uuid: "history-1",
        value: 240,
        delta: undefined,
      }),
      expect.objectContaining({
        uuid: "history-2",
        value: 220,
        delta: -20,
      }),
    ]);
  });
});
