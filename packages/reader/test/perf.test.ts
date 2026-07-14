import { describe, expect, it } from "vitest";

import { perf } from "../src/perf/index.js";
import { readResults } from "./utils.js";

describe("perf reader", () => {
  it("reads explicit perf.json metric samples and keeps the raw file as a global attachment", async () => {
    const visitor = await readResults(perf, {
      "perf/explicit.json": "perf.json",
    });

    expect(visitor.visitMetrics).toHaveBeenCalledTimes(1);
    expect(visitor.visitMetrics.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        key: "generate.total.avgMs",
        value: 123.45,
        unit: "ms",
        group: "Report generation",
        source: "perf.json",
        better: "lower",
        display: { history: true },
      }),
      expect.objectContaining({
        key: "assets.jsMb",
        value: 3.5,
        unit: "MB",
        group: "Report generation",
        source: "perf.json",
      }),
    ]);
    expect(visitor.visitAttachmentFile).toHaveBeenCalledTimes(1);
    expect(visitor.visitGlobals.mock.calls[0][0].attachments[0]).toMatchObject({
      name: "perf.json",
      originalFileName: "perf.json",
    });
  });

  it("adapts current allure perf hooks summaries", async () => {
    const visitor = await readResults(perf, {
      "perf/allure-perf-metrics.json": "allure-perf-metrics.json",
    });
    const metrics = visitor.visitMetrics.mock.calls[0][0];

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "allure.total.avgMs",
          value: 220,
          unit: "ms",
          better: "lower",
          display: { history: true },
        }),
        expect.objectContaining({ key: "generate.total.count", value: 1, unit: "count", better: "neutral" }),
        expect.objectContaining({ key: "generate.total.totalMs", value: 200, unit: "ms", better: "lower" }),
        expect.objectContaining({ key: "generate.total.minMs", value: 200, unit: "ms", better: "lower" }),
        expect.objectContaining({ key: "generate.total.maxMs", value: 200, unit: "ms", better: "lower" }),
        expect.objectContaining({ key: "generate.total.avgMs", value: 200, unit: "ms", better: "lower" }),
      ]),
    );
  });

  it("flattens arbitrary numeric JSON leaves in perf.json", async () => {
    const visitor = await readResults(perf, {
      "perf/arbitrary.json": "perf.json",
    });

    expect(visitor.visitMetrics.mock.calls[0][0]).toEqual([
      expect.objectContaining({ key: "browser.coldLoadMs", value: 550.4, unit: "ms" }),
      expect.objectContaining({ key: "browser.heap.usedMb", value: 42, unit: "MB" }),
      expect.objectContaining({ key: "lint.errors", value: 0 }),
      expect.objectContaining({ key: "lint.warnings", value: 3 }),
    ]);
  });
});
