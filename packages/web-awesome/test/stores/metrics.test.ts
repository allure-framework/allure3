import { describe, expect, it } from "vitest";

import {
  defaultMetricKey,
  metricHistoryRows,
  metricSummaryRows,
  metricRows,
  type MetricsWidgetData,
} from "@/stores/metrics";

const data: MetricsWidgetData = {
  current: [
    {
      key: "generate.total.avgMs",
      value: 180,
      unit: "ms",
      source: "allure-perf-metrics.json",
      better: "lower",
    },
    {
      key: "generate.total.count",
      value: 1,
      unit: "count",
      source: "allure-perf-metrics.json",
      better: "neutral",
    },
    {
      key: "generate.total.totalMs",
      value: 180,
      unit: "ms",
      source: "allure-perf-metrics.json",
      better: "lower",
    },
    {
      key: "generate.total.minMs",
      value: 180,
      unit: "ms",
      source: "allure-perf-metrics.json",
      better: "lower",
    },
    {
      key: "generate.total.maxMs",
      value: 180,
      unit: "ms",
      source: "allure-perf-metrics.json",
      better: "lower",
    },
    {
      key: "browser.heap.usedMb",
      value: 48,
      unit: "MB",
      source: "perf.json",
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
          { key: "generate.total.avgMs", value: 220 },
          { key: "generate.total.avgMs", value: 180 },
          { key: "generate.total.count", value: 1 },
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
            key: "parser.duration.avgMs",
            value: 20,
            unit: "ms",
            group: "backend",
            source: "perf.json",
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

  it("should select the largest current metric value by default", () => {
    expect(
      defaultMetricKey({
        current: [
          { key: "small.total.avgMs", value: 10 },
          { key: "large.total.avgMs", value: 20 },
          { key: "large.total.count", value: 1 },
          { key: "other.metric", value: 100 },
        ],
        history: [],
      }),
    ).toBe("other.metric");
  });

  it("should prefer configured history metric by default", () => {
    expect(
      defaultMetricKey({
        display: {
          historyMetricKey: "browser.heap.usedMb",
        },
        current: [
          { key: "large.total.avgMs", value: 200 },
          { key: "browser.heap.usedMb", value: 48 },
        ],
        history: [],
      }),
    ).toBe("browser.heap.usedMb");
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
