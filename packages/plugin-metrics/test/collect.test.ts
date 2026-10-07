import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { collectMetrics } from "../src/collect.js";
import type { MetricsInput } from "../src/model.js";

beforeEach(async () => {
  await story("collect");
});

const input = (overrides: Partial<MetricsInput> = {}): MetricsInput => ({
  statistic: {},
  testResults: [],
  retries: 0,
  ...overrides,
});

const value = (lines: ReturnType<typeof collectMetrics>, name: string, key: string) =>
  lines.find((line) => line.name === name && line.key === key)?.value;

describe("collectMetrics", () => {
  it("emits every status even when it is absent from the statistic", () => {
    const lines = collectMetrics(input({ statistic: { passed: 3, failed: 1 } }));
    const statuses = lines.filter((line) => line.name === "launch_status");

    expect(statuses.map(({ key, value: v }) => [key, v])).toEqual([
      ["failed", 1],
      ["broken", 0],
      ["passed", 3],
      ["skipped", 0],
      ["unknown", 0],
    ]);
  });

  it("computes time metrics the same way as Allure 2 GroupTime", () => {
    const lines = collectMetrics(
      input({
        testResults: [
          { start: 1000, stop: 1100, duration: 100 },
          { start: 1050, stop: 1400, duration: 350 },
          { start: 900, stop: 950, duration: 50 },
        ],
      }),
    );

    expect(value(lines, "launch_time", "duration")).toBe(500);
    expect(value(lines, "launch_time", "min_duration")).toBe(50);
    expect(value(lines, "launch_time", "max_duration")).toBe(350);
    expect(value(lines, "launch_time", "sum_duration")).toBe(500);
    expect(value(lines, "launch_time", "start")).toBe(900);
    expect(value(lines, "launch_time", "stop")).toBe(1400);
  });

  it("reports zero time metrics for an empty run", () => {
    const lines = collectMetrics(input());

    expect(lines.filter((line) => line.name === "launch_time").map((line) => line.value)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("ignores results without timings", () => {
    const lines = collectMetrics(input({ testResults: [{}, { start: 10, stop: 30, duration: 20 }] }));

    expect(value(lines, "launch_time", "duration")).toBe(20);
    expect(value(lines, "launch_time", "min_duration")).toBe(20);
  });

  it("counts results per category", () => {
    const lines = collectMetrics(
      input({
        testResults: [
          { categories: [{ name: "Product errors" }] },
          { categories: [{ name: "Product errors" }] },
          { categories: [{ name: "Test errors" }] },
          { categories: [] },
          {},
        ],
      }),
    );

    expect(lines.filter((line) => line.name === "launch_problems")).toEqual([
      { name: "launch_problems", key: "Product errors", value: 2 },
      { name: "launch_problems", key: "Test errors", value: 1 },
    ]);
  });

  it("separates retries from runs", () => {
    const lines = collectMetrics(input({ testResults: [{}, {}, {}], retries: 2 }));

    expect(value(lines, "launch_retries", "retries")).toBe(2);
    expect(value(lines, "launch_retries", "run")).toBe(3);
  });

  it("averages performance metrics per key and skips invalid samples", () => {
    const lines = collectMetrics(
      input({
        performanceMetrics: [
          { id: "1", key: "ttfb", value: 10, start: 0, stop: 1 },
          { id: "2", key: "ttfb", value: 20, start: 0, stop: 1 },
          { id: "3", key: "lcp", value: Number.NaN, start: 0, stop: 1 },
        ],
      }),
    );

    expect(lines.filter((line) => line.name === "launch_metric")).toEqual([
      { name: "launch_metric", key: "ttfb", value: 15 },
    ]);
  });
});
