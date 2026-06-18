import { feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { createHistory } from "../src/history.js";
import { DefaultAllureStore } from "../src/store/store.js";

beforeEach(async () => {
  await feature("metrics");
  await story("perf metrics");
  await label("coverage", "metrics");
});

describe("metrics", () => {
  it("stores, dumps, and restores metric samples", async () => {
    const source = new DefaultAllureStore();

    await source.visitMetrics([
      {
        key: "generate.total.avgMs",
        value: 123,
        unit: "ms",
        source: "perf.json",
        better: "lower",
      },
    ]);

    expect(await source.allMetrics()).toEqual([
      {
        key: "generate.total.avgMs",
        value: 123,
        unit: "ms",
        source: "perf.json",
        better: "lower",
      },
    ]);

    const target = new DefaultAllureStore();

    await target.restoreState(source.dumpState());

    expect(await target.allMetrics()).toEqual(await source.allMetrics());
  });

  it("writes latest metric values into history metrics", () => {
    const historyPoint = createHistory("report-1", "Report", [], [], "", [
      {
        key: "generate.total.avgMs",
        value: 200,
      },
      {
        key: "generate.total.avgMs",
        value: 150,
      },
      {
        key: "lint.errors",
        value: 0,
      },
    ]);

    expect(historyPoint.metrics).toEqual({
      "generate.total.avgMs": 150,
      "lint.errors": 0,
    });
  });
});
