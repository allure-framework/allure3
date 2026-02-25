import { ChartType } from "@allurereport/charts-api";
import type { AllureChartsStoreData } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";
import {
  generateStabilityDistributionChart,
  getStabilityScore,
} from "../../src/charts/generateStabilityDistributionChart.js";

const historyDepth = 10;
const stabilizationPeriod = 5;

describe("getStabilityScore", () => {
  it("Example 1: effectiveSequenceLength = 0 (only skipped) → undefined", () => {
    const statuses: TestStatus[] = []; // after filter: empty
    expect(getStabilityScore(statuses, historyDepth, stabilizationPeriod)).toBeUndefined();
  });

  it("Example 2: effectiveSequenceLength = 1 (single passed) → 1", () => {
    expect(getStabilityScore(["passed"], historyDepth, stabilizationPeriod)).toBe(1);
  });

  it("Example 3: latest stabilizationPeriod consecutive passed at end → 1 (Rule 3)", () => {
    const statuses: TestStatus[] = [
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
    ];
    expect(getStabilityScore(statuses, historyDepth, stabilizationPeriod)).toBe(1);
  });

  it("Example 4: latest 5 consecutive P not at end, one transition in relevant edges → 1 (Rule 4)", () => {
    const statuses: TestStatus[] = [
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "failed",
    ];
    expect(getStabilityScore(statuses, historyDepth, stabilizationPeriod)).toBe(1);
  });

  it("Example 5: P->F->F->P, two transitions P->F and F->P → 1 (Rule 6)", () => {
    const statuses: TestStatus[] = [
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "failed",
      "failed",
      "passed",
    ];
    expect(getStabilityScore(statuses, historyDepth, stabilizationPeriod)).toBe(1);
  });

  it("Example 6: no 5 consecutive, multiple transitions → SR = 30/45 ≈ 0.67 (Rule 7)", () => {
    const statuses: TestStatus[] = [
      "passed",
      "broken",
      "passed",
      "failed",
      "failed",
      "failed",
      "passed",
      "failed",
      "broken",
      "passed",
    ];
    const score = getStabilityScore(statuses, historyDepth, stabilizationPeriod);
    expect(score).toBeCloseTo(30 / 45, 4);
    expect(score).toBeCloseTo(0.6667, 4);
  });

  it("Example 7: latest 5 consecutive are failed (not passed), firstEdgeAfterStabilBlock=6 → SR = 22/45 ≈ 0.49 (Rule 7)", () => {
    const statuses: TestStatus[] = [
      "broken",
      "failed",
      "failed",
      "failed",
      "failed",
      "failed",
      "broken",
      "passed",
      "passed",
      "failed",
    ];
    const score = getStabilityScore(statuses, historyDepth, stabilizationPeriod);
    expect(score).toBeCloseTo(22 / 45, 4);
    expect(score).toBeCloseTo(0.4889, 4);
  });

  it("Rule 5: two transitions P->B then B->P → 1", () => {
    const statuses: TestStatus[] = [
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "broken",
      "passed",
    ];
    expect(getStabilityScore(statuses, historyDepth, stabilizationPeriod)).toBe(1);
  });
});

const baseTestResult: Pick<
  TestResult,
  | "id"
  | "name"
  | "flaky"
  | "muted"
  | "known"
  | "hidden"
  | "labels"
  | "parameters"
  | "links"
  | "steps"
  | "sourceMetadata"
> = {
  id: "tr-1",
  name: "Test",
  flaky: false,
  muted: false,
  known: true,
  hidden: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "", metadata: {} },
};

const createTestResult = (overrides: Partial<TestResult> & { status?: TestStatus }): TestResult => {
  return { ...baseTestResult, status: "passed", ...overrides };
};

const createHistoryTestResult = (
  overrides: Partial<HistoryTestResult> & { status: TestStatus; historyId: string },
): HistoryTestResult => ({
  id: "tr-1",
  name: "Test",
  url: "http://example.com",
  ...overrides,
});

const createHistoryDataPoint = (overrides: Partial<HistoryDataPoint>): HistoryDataPoint => ({
  uuid: "hdp-1",
  name: "Run 1",
  timestamp: 1000,
  knownTestCaseIds: [],
  testResults: {},
  metrics: {},
  url: "http://example.com",
  ...overrides,
});

const createStoreData = (overrides: Partial<AllureChartsStoreData>): AllureChartsStoreData => ({
  historyDataPoints: [],
  testResults: [],
  statistic: { total: 0 },
  ...overrides,
});

describe("generateStabilityDistributionChart", () => {
  it("should return chart with type StabilityDistribution and default threshold", () => {
    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData: createStoreData({}),
    });

    expect(result.type).toBe(ChartType.StabilityDistribution);
    expect(result.threshold).toBe(90);
    expect(result.data).toEqual([]);
    expect(result.keys).toEqual({});
  });

  it("should use custom title and threshold from options", () => {
    const result = generateStabilityDistributionChart({
      options: {
        type: ChartType.StabilityDistribution,
        title: "Feature stability",
        threshold: 85,
      },
      storeData: createStoreData({}),
    });

    expect(result.title).toBe("Feature stability");
    expect(result.threshold).toBe(85);
  });

  it("should group by feature label and compute average stability rate", () => {
    const historyId = "hid-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [historyId]: createHistoryTestResult({ historyId, status: "passed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 2000,
          testResults: {
            [historyId]: createHistoryTestResult({ historyId, status: "failed" }),
          },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          historyId,
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: {
        type: ChartType.StabilityDistribution,
        groupBy: "feature",
        limit: 5,
        stabilizationPeriod: 2,
      },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].stabilityRate).toBe(100); // P then P → Rule 2 then Rule 3 or single transition
    expect(Object.values(result.keys)).toContain("Auth");
  });

  it("should skip tests without label value for groupBy", () => {
    const storeData = createStoreData({
      testResults: [createTestResult({ id: "tr-1", status: "passed", labels: [] })],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution, groupBy: "feature" },
      storeData,
    });

    expect(result.data).toHaveLength(0);
  });

  it("should skip tests with status in skipStatuses", () => {
    const storeData = createStoreData({
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "skipped",
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(result.data).toHaveLength(0);
  });

  it("should filter by groupValues when provided", () => {
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            h1: createHistoryTestResult({ historyId: "h1", status: "passed" }),
            h2: createHistoryTestResult({ historyId: "h2", status: "passed" }),
          },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          historyId: "h1",
          labels: [{ name: "feature", value: "Auth" }],
        }),
        createTestResult({
          id: "tr-2",
          status: "passed",
          historyId: "h2",
          labels: [{ name: "feature", value: "Billing" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: {
        type: ChartType.StabilityDistribution,
        groupBy: "feature",
        groupValues: ["Auth"],
        limit: 5,
        stabilizationPeriod: 1,
      },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(Object.values(result.keys)).toContain("Auth");
    expect(Object.values(result.keys)).not.toContain("Billing");
  });

  it("should average stability scores per group (Example 6-like scenario)", () => {
    const historyId = "hid-1";
    const statuses: TestStatus[] = [
      "passed",
      "broken",
      "passed",
      "failed",
      "failed",
      "failed",
      "passed",
      "failed",
      "broken",
      "passed",
    ];
    const storeData = createStoreData({
      historyDataPoints: statuses.slice(0, -1).map((status, i) =>
        createHistoryDataPoint({
          uuid: `run-${i}`,
          timestamp: 1000 + i,
          testResults: {
            [historyId]: createHistoryTestResult({ historyId, status }),
          },
        }),
      ),
      testResults: [
        createTestResult({
          id: "tr-1",
          status: statuses[statuses.length - 1],
          historyId,
          labels: [{ name: "feature", value: "Flaky" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    // Expected score 30/45 ≈ 66.67%
    expect(result.data[0].stabilityRate).toBeGreaterThanOrEqual(66);
    expect(result.data[0].stabilityRate).toBeLessThanOrEqual(67);
  });

  it("should use only the most recent contiguous history block when test is absent in a point", () => {
    const historyId = "hid-1";
    // Point 1: test passed; Point 2: test absent (gap); Point 3: test failed; Current: passed.
    // With contiguous block we only use [failed, passed] → one transition → Rule 4 → score 1.
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: {
            [historyId]: createHistoryTestResult({ historyId, status: "passed" }),
          },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 2000,
          testResults: {}, // test absent
        }),
        createHistoryDataPoint({
          uuid: "run-3",
          timestamp: 3000,
          testResults: {
            [historyId]: createHistoryTestResult({ historyId, status: "failed" }),
          },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          historyId,
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: {
        type: ChartType.StabilityDistribution,
        limit: 5,
        stabilizationPeriod: 3,
      },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    // Sequence is [failed, passed] → one transition → stability 1 → 100%
    expect(result.data[0].stabilityRate).toBe(100);
  });
});
