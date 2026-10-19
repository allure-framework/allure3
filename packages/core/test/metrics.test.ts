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
        id: "generate-total",
        key: "generate.total.avgMs",
        value: 123,
        start: 0,
        stop: 1,
      },
    ]);

    expect(await source.allMetrics()).toEqual([
      {
        id: "generate-total",
        key: "generate.total.avgMs",
        value: 123,
        start: 0,
        stop: 1,
      },
    ]);

    const target = new DefaultAllureStore();

    await target.restoreState(source.dumpState());

    expect(await target.allMetrics()).toEqual(await source.allMetrics());
  });

  it("ignores malformed metric results", async () => {
    const store = new DefaultAllureStore();

    await store.visitMetrics([
      {
        id: "",
        key: "bundle.size",
        value: 10,
        start: 0,
        stop: 1,
      },
      {
        id: "missing-key",
        key: "",
        value: 10,
        start: 0,
        stop: 1,
      },
      {
        id: "missing-timing",
        key: "bundle.size",
        value: 10,
        start: Number.NaN,
        stop: 1,
      },
      {
        id: "valid",
        key: "bundle.size",
        value: 10,
        start: 0,
        stop: 1,
      },
    ]);

    expect(await store.allMetrics()).toEqual([
      {
        id: "valid",
        key: "bundle.size",
        value: 10,
        start: 0,
        stop: 1,
      },
    ]);
  });

  it("writes average metric values into history metrics", () => {
    const historyPoint = createHistory("report-1", "Report", [], [], "", [
      {
        id: "first",
        key: "generate.total.avgMs",
        value: 200,
        start: 0,
        stop: 1,
      },
      {
        id: "second",
        key: "generate.total.avgMs",
        value: 150,
        start: 1,
        stop: 2,
      },
      {
        id: "lint",
        key: "lint.errors",
        value: 0,
        start: 2,
        stop: 3,
      },
    ]);

    expect(historyPoint.metrics).toEqual({
      "generate.total.avgMs": 175,
      "lint.errors": 0,
    });
  });
});
