import type { TestResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createTimelineData, generateTimeline } from "../src/generateTimeline.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("timeline");
  await label("coverage", "report-output");
});

const mockTestResult = (overrides: Partial<TestResult> = {}): TestResult =>
  ({
    id: "tr-1",
    name: "test",
    status: "passed",
    start: 1000,
    stop: 1500,
    duration: 500,
    flaky: false,
    isRetry: false,
    retryHash: "retry-hash",
    labels: [
      { name: "host", value: "host-1" },
      { name: "thread", value: "thread-1" },
    ],
    ...overrides,
  }) as TestResult;

describe("createTimelineData", () => {
  it("should map test results with host and thread labels to timeline items", () => {
    const result = createTimelineData([mockTestResult({ flaky: true, environment: "default" })]);

    expect(result).toEqual([
      {
        id: "tr-1",
        name: "test",
        status: "passed",
        flaky: true,
        isRetry: false,
        retryHash: "retry-hash",
        environment: "default",
        host: "host-1",
        thread: "thread-1",
        start: 1000,
        duration: 500,
      },
    ]);
  });

  it("should compute duration from start and stop when duration is missing", () => {
    const [item] = createTimelineData([mockTestResult({ duration: undefined, start: 10, stop: 25 })]);

    expect(item.duration).toBe(15);
  });

  it("should skip test results without timestamps", () => {
    const result = createTimelineData([
      mockTestResult({ id: "no-start", start: undefined }),
      mockTestResult({ id: "no-stop", stop: undefined }),
    ]);

    expect(result).toEqual([]);
  });

  it("should skip test results without host or thread labels", () => {
    const result = createTimelineData([
      mockTestResult({ id: "no-host", labels: [{ name: "thread", value: "thread-1" }] }),
      mockTestResult({ id: "no-thread", labels: [{ name: "host", value: "host-1" }] }),
      mockTestResult({
        id: "empty-host",
        labels: [
          { name: "host", value: "" },
          { name: "thread", value: "thread-1" },
        ],
      }),
    ]);

    expect(result).toEqual([]);
  });

  it("should skip test results shorter than the default min duration", () => {
    const result = createTimelineData([mockTestResult({ id: "zero", start: 5, stop: 5, duration: 0 })]);

    expect(result).toEqual([]);
  });

  it("should respect the configured min duration", () => {
    const result = createTimelineData(
      [mockTestResult({ id: "short", duration: 50 }), mockTestResult({ id: "long", duration: 200 })],
      { timeline: { minDuration: 100 } },
    );

    expect(result.map(({ id }) => id)).toEqual(["long"]);
  });

  it("should keep retries so they can be shown on the timeline", () => {
    const result = createTimelineData([
      mockTestResult({ id: "retry", isRetry: true }),
      mockTestResult({ id: "final" }),
    ]);

    expect(result.map(({ id, isRetry }) => ({ id, isRetry }))).toEqual([
      { id: "retry", isRetry: true },
      { id: "final", isRetry: false },
    ]);
  });
});

describe("generateTimeline", () => {
  it("should write timeline widget", async () => {
    const writeWidget = vi.fn();

    await generateTimeline({ writeWidget }, [mockTestResult(), mockTestResult({ id: "skipped", labels: [] })]);

    expect(writeWidget).toHaveBeenCalledTimes(1);
    expect(writeWidget).toHaveBeenCalledWith("timeline.json", [expect.objectContaining({ id: "tr-1" })]);
  });

  it("should write an empty timeline when no test results qualify", async () => {
    const writeWidget = vi.fn();

    await generateTimeline({ writeWidget }, []);

    expect(writeWidget).toHaveBeenCalledWith("timeline.json", []);
  });
});
