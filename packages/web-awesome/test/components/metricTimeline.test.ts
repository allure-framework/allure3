import { describe, expect, it } from "vite-plus/test";

import { deltaDirection } from "@/components/ReportMetrics/format";
import { metricTimeline } from "@/components/ReportMetrics/timeline";
import type { MetricsWidgetData } from "@/stores/metrics";

const sample = (key: string, start: number, stop: number, id = key) => ({ id, key, value: 1, start, stop });
const data = (current: MetricsWidgetData["current"]): MetricsWidgetData => ({
  hierarchy: [{ key: "run", children: [{ key: "missing", children: [{ key: "child", children: [] }] }] }],
  current,
  history: [],
});

describe("metric timeline", () => {
  it("uses recorded intervals without adding overlapping values or requiring intermediate measurements", () => {
    const input = data([
      sample("run", 1000, 1100),
      sample("child", 1000, 1080, "first"),
      sample("child", 1020, 1100, "second"),
    ]);
    const before = structuredClone(input);
    const model = metricTimeline(input);
    expect(model.duration).toBe(100);
    expect(model.rows.map(({ depth }) => depth)).toEqual([0, 2]);
    expect(model.rows[1].intervals.map(({ lane, sample: s }) => [lane, s.start, s.stop])).toEqual([
      [0, 1000, 1080],
      [1, 1020, 1100],
    ]);
    expect(input).toEqual(before);
  });

  it("reuses lanes for disjoint repeats and keeps zero-duration measurements as points", () => {
    const model = metricTimeline(
      data([sample("child", 2, 3, "b"), sample("child", 0, 2, "a"), sample("child", 3, 3, "point")]),
    );
    expect(model.rows[0].intervals.map(({ lane }) => lane)).toEqual([0, 0, 1]);
    expect(model.rows[0].intervals.map(({ sample: s }) => s.id)).toEqual(["a", "b", "point"]);
    expect(metricTimeline(data([sample("run", 7, 7)])).hasIntervals).toBe(true);
    const points = metricTimeline(data([sample("child", 7, 7, "a"), sample("child", 7, 7, "b")]));
    expect(points.rows[0].intervals.map(({ lane }) => lane)).toEqual([0, 1]);
  });

  it("does not infer hierarchy from prefixes and chooses stable available roots", () => {
    const input = data([sample("z.extra", 0, 2), sample("run", 0, 2), sample("a.extra", 0, 2)]);
    expect(metricTimeline(input).roots).toEqual(["a.extra", "run", "z.extra"]);
    expect(metricTimeline(input).root).toBe("a.extra");
    expect(metricTimeline(input, "run").rows).toHaveLength(1);
    expect(metricTimeline(input, "removed").root).toBe("a.extra");
    expect(metricTimeline({ current: [sample("legacy", 0, 2)], history: [] }).rows[0].intervals[0].sample.key).toBe(
      "legacy",
    );
  });

  it("rejects invalid intervals without hiding valid zero or negative metric values", () => {
    const input = data([
      sample("run", NaN, 1),
      sample("run", 2, 1),
      sample("run", 0, Infinity),
      sample("run", -Number.MAX_VALUE, Number.MAX_VALUE),
      { ...sample("child", 0, 2), value: -1 },
    ]);
    const model = metricTimeline(input);
    expect(model.excluded).toBe(4);
    expect(model.rows[0].intervals[0].sample.value).toBe(-1);
    expect(metricTimeline(data([sample("run", 2, 1)])).hasIntervals).toBe(false);
    expect(metricTimeline({ current: [], history: [] }).roots).toEqual([]);
  });

  it("does not use metric value or units as elapsed time, including benchmark means", () => {
    const input = data([
      { ...sample("run", 10, 110), value: 0.002, unit: "ms" },
      { ...sample("child", 10, 110), value: 2048, unit: "bytes" },
    ]);
    expect(metricTimeline(input).duration).toBe(100);
    expect(metricTimeline(input).rows[1].intervals[0].sample.value).toBe(2048);
  });

  it("packs sibling keys at the same configured depth while separating concurrent intervals", () => {
    const input: MetricsWidgetData = {
      current: [sample("run", 0, 100), sample("a", 0, 40), sample("b", 40, 80), sample("c", 20, 60)],
      history: [],
      hierarchy: [{ key: "run", children: ["a", "b", "c"].map((key) => ({ key, children: [] })) }],
    };
    const model = metricTimeline(input);
    expect(model.rows).toHaveLength(2);
    expect(model.rows[1].intervals.map(({ sample: s, lane }) => [s.key, lane])).toEqual([
      ["a", 0],
      ["c", 1],
      ["b", 0],
    ]);
  });

  it.each([
    ["lower", -1, "good"],
    ["lower", 1, "bad"],
    ["higher", 1, "good"],
    ["higher", -1, "bad"],
    ["neutral", 1, "neutral"],
    [undefined, -1, "neutral"],
    ["lower", 0, "neutral"],
    ["lower", undefined, "neutral"],
  ] as const)("matches table direction for %s / %s", (better, delta, expected) => {
    expect(deltaDirection({ better, delta })).toBe(expected);
  });
});
