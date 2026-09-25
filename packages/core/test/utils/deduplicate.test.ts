import type { HistoryDataPoint, HistoryTestResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { StringPool, deduplicateHistoryDataPoints } from "../../src/utils/deduplicate.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("memory");
  await story("deduplication");
  await label("coverage", "memory");
});

// Separate JSON.parse calls produce separate objects, as when history points are read line by line.
const parsePoint = (uuid: string, testResults: Record<string, HistoryTestResult>): HistoryDataPoint =>
  JSON.parse(
    JSON.stringify({
      uuid,
      name: "report",
      timestamp: 1,
      knownTestCaseIds: ["tc-1", "tc-2"],
      testResults,
      metrics: {},
      url: "",
    }),
  );

const historyTestResult = (id: string, overrides: Partial<HistoryTestResult> = {}): HistoryTestResult =>
  ({
    id,
    name: "test",
    fullName: "suite.test",
    environment: "default",
    status: "failed",
    message: "boom",
    trace: "at line 1",
    url: "",
    historyId: "tc-1.hash",
    labels: [
      { name: "suite", value: "suite" },
      { name: "host", value: `agent-${id}` },
    ],
    ...overrides,
  }) as HistoryTestResult;

describe("StringPool", () => {
  it("should return values equal to the input and leave non-strings alone", () => {
    const stringPool = new StringPool();
    const object = { a: 1 };

    expect(stringPool.deduplicate("value")).toBe("value");
    expect(stringPool.deduplicate("value")).toBe("value");
    expect(stringPool.deduplicate(undefined)).toBeUndefined();
    expect(stringPool.deduplicate(object)).toBe(object);
  });
});

describe("deduplicateHistoryDataPoints", () => {
  it("should keep every history value unchanged", () => {
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1") }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2", { status: "passed" }) }),
    ];
    const before = JSON.stringify(points);

    deduplicateHistoryDataPoints(points);

    expect(JSON.stringify(points)).toBe(before);
  });

  it("should share equal label objects between history points", () => {
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1") }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2") }),
    ];

    deduplicateHistoryDataPoints(points);

    const [first, second] = points.map((point) => point.testResults["tc-1.hash"].labels!);

    expect(first[0]).toBe(second[0]);
    // host differs between runs, so those labels stay separate
    expect(first[1]).not.toBe(second[1]);
    expect(first[1]).toEqual({ name: "host", value: "agent-r1" });
    expect(second[1]).toEqual({ name: "host", value: "agent-r2" });
  });

  it("should not merge labels that only look alike as strings", () => {
    const labels = [
      { name: "x" },
      { name: "x", value: "undefined" },
      { name: "y", value: "null" },
      { name: "y", value: null },
      { name: "z", value: "1", extra: true },
      { name: "z", value: "1" },
    ] as unknown as HistoryTestResult["labels"];
    const points = [
      parsePoint("run-1", { "tc-1.hash": historyTestResult("r1", { labels }) }),
      parsePoint("run-2", { "tc-1.hash": historyTestResult("r2", { labels }) }),
    ];
    const before = JSON.stringify(points);

    deduplicateHistoryDataPoints(points);

    expect(JSON.stringify(points)).toBe(before);
    expect(points[0].testResults["tc-1.hash"].labels).toEqual(labels);
    expect(points[1].testResults["tc-1.hash"].labels).toEqual(labels);
  });

  it("should leave frozen history items untouched", () => {
    const frozenLabels = Object.freeze([Object.freeze({ name: "suite", value: "suite" })]);
    const frozen = Object.freeze(historyTestResult("r1", { labels: frozenLabels as HistoryTestResult["labels"] }));
    const point = parsePoint("run-1", {});

    point.testResults["tc-1.hash"] = frozen;

    expect(() => deduplicateHistoryDataPoints([point])).not.toThrow();
    expect(point.testResults["tc-1.hash"]).toBe(frozen);
    expect(point.testResults["tc-1.hash"].labels).toBe(frozenLabels);
  });

  it("should tolerate points without test results or labels", () => {
    const point = parsePoint("run-1", { "tc-1.hash": historyTestResult("r1", { labels: undefined }) });

    delete (point as Partial<HistoryDataPoint>).knownTestCaseIds;

    expect(() => deduplicateHistoryDataPoints([point, { ...point, testResults: undefined! }])).not.toThrow();
    expect(point.testResults["tc-1.hash"].labels).toBeUndefined();
  });
});
