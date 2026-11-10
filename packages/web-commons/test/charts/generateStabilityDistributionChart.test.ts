import { ChartType } from "@allurereport/charts-api";
import type { AllureChartsStoreData } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { generateStabilityDistributionChart } from "../../src/charts/generateStabilityDistributionChart.js";

let historyResultId = 0;
beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("generateStabilityDistributionChart");
  await label("coverage", "charts");
  historyResultId = 0;
});

const historyDepth = 10;
const stabilizationPeriod = 5;

const baseTestResult: Pick<
  TestResult,
  | "id"
  | "name"
  | "flaky"
  | "muted"
  | "known"
  | "isRetry"
  | "labels"
  | "parameters"
  | "links"
  | "steps"
  | "sourceMetadata"
  | "testCaseHash"
  | "parametersHash"
  | "environmentHash"
  | "retryHash"
> = {
  id: "tr-1",
  testCaseHash: null,
  parametersHash: "",
  environmentHash: null,
  retryHash: null,
  name: "Test",
  flaky: false,
  muted: false,
  known: true,
  isRetry: false,
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
  overrides: Partial<HistoryTestResult> & { status: TestStatus; retryHash: string },
): HistoryTestResult => ({
  id: `historical-${historyResultId++}`,
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

const sequenceInput = (statuses: TestStatus[]): Parameters<typeof generateStabilityDistributionChart>[0] => {
  const retryHash = "sequence";
  return {
    options: { type: ChartType.StabilityDistribution, limit: historyDepth, stabilizationPeriod },
    storeData: createStoreData({
      historyDataPoints: statuses.slice(0, -1).map((status, index) =>
        createHistoryDataPoint({
          uuid: `run-${index}`,
          timestamp: 1000 + index,
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status }) },
        }),
      ),
      testResults: [
        createTestResult({
          status: statuses.at(-1) ?? "unknown",
          retryHash,
          labels: [{ name: "feature", value: "Sequence" }],
        }),
      ],
    }),
  };
};

describe("stability chart history defaults", () => {
  it.each(["status-changes", "retry-failure-rate"] as const)(
    "uses all comparable history when limit is omitted for %s",
    (algorithm) => {
      const statuses: TestStatus[] = [
        "failed",
        ...Array(4).fill("passed"),
        ...Array(3).fill("failed"),
        ...Array(4).fill("passed"),
      ];
      const input = sequenceInput(statuses);
      input.options = { type: ChartType.StabilityDistribution, algorithm };
      input.storeData.historyDataPoints.forEach((point) => {
        point.testResults.sequence!.retries = [];
      });
      input.storeData.historyDataPoints[0].testResults.sequence!.retries = ["broken"];

      const chart = generateStabilityDistributionChart(input);

      expect(chart.data.map((group) => ({ label: chart.keys[group.id], rate: group.stabilityRate }))).toEqual([
        { label: "Sequence", rate: 0 },
      ]);
    },
  );
});

describe("retry failure-rate stability charts", () => {
  it("aggregates assessed decisions independently of badges and counts uniform failures", () => {
    const result = createTestResult({
      id: "recovery",
      retryHash: "recovery",
      labels: [{ name: "feature", value: "Auth" }],
    });
    const mixedFailure = createTestResult({
      id: "mixed-failure",
      retryHash: "mixed-failure",
      status: "broken",
      labels: result.labels,
    });
    const input = {
      options: { type: ChartType.StabilityDistribution, algorithm: "retry-failure-rate", threshold: 50 } as const,
      storeData: createStoreData({
        testResults: [
          createTestResult({ id: "clean", retryHash: "clean", labels: result.labels }),
          createTestResult({ id: "badge-only", retryHash: "badge-only", labels: result.labels, flaky: true }),
          { ...result, retries: [{ ...result, id: "retry", status: "failed" }] },
          { ...mixedFailure, retries: [{ ...mixedFailure, id: "mixed-retry", status: "failed" }] },
          createTestResult({ id: "persistent", retryHash: "persistent", status: "failed", labels: result.labels }),
          createTestResult({
            id: "reported",
            retryHash: "reported",
            status: "failed",
            labels: [{ name: "feature", value: "Billing" }],
            sourceMetadata: { ...baseTestResult.sourceMetadata, reportedFlaky: true },
          }),
        ],
      }),
    };

    const chart = generateStabilityDistributionChart(input);

    expect(chart.threshold).toBe(50);
    expect(chart.data.map((group) => ({ label: chart.keys[group.id], rate: group.stabilityRate }))).toEqual([
      { label: "Auth", rate: 40 },
      { label: "Billing", rate: 0 },
    ]);
  });

  it("forwards the retry cutoff without treating the group threshold as a classifier cutoff", () => {
    const input = sequenceInput(["passed", "passed"]);
    const current = input.storeData.testResults[0];
    current.retries = [{ ...current, id: "retry", status: "failed" }];
    input.storeData.historyDataPoints[0].testResults[current.retryHash!]!.retries = [];
    input.options.algorithm = "retry-failure-rate";

    const unstable = generateStabilityDistributionChart(input);
    const stable = generateStabilityDistributionChart({
      ...input,
      options: { ...input.options, retryFailureThreshold: 0.4, threshold: 50 },
    });

    expect(unstable.data[0].stabilityRate).toBe(0);
    expect(stable.data[0].stabilityRate).toBe(100);
    expect(stable.threshold).toBe(50);
  });

  it("assesses historical mixed failure statuses as unstable", () => {
    const input = sequenceInput(["broken", "failed"]);
    const current = input.storeData.testResults[0];
    input.storeData.historyDataPoints[0].testResults[current.retryHash!]!.retries = ["failed"];
    input.options.algorithm = "retry-failure-rate";

    const chart = generateStabilityDistributionChart(input);

    expect(chart.data.map((group) => ({ label: chart.keys[group.id], rate: group.stabilityRate }))).toEqual([
      { label: "Sequence", rate: 0 },
    ]);
  });

  it("excludes incomplete historical attempts while counting the current failure", () => {
    const input = sequenceInput(["passed", "failed"]);
    const current = input.storeData.testResults[0];
    input.options.algorithm = "retry-failure-rate";
    input.options.retryFailureThreshold = 0.75;

    const incomplete = generateStabilityDistributionChart(input);
    input.storeData.historyDataPoints[0].testResults[current.retryHash!]!.retries = [];
    const complete = generateStabilityDistributionChart(input);

    expect(incomplete.data.map((group) => ({ label: incomplete.keys[group.id], rate: group.stabilityRate }))).toEqual([
      { label: "Sequence", rate: 0 },
    ]);
    expect(complete.data.map((group) => ({ label: complete.keys[group.id], rate: group.stabilityRate }))).toEqual([
      { label: "Sequence", rate: 100 },
    ]);
  });

  it.each([
    { executions: 4, expected: [{ label: "Sequence", rate: 0 }] },
    { executions: 5, expected: [] },
  ])("assesses uniform retry failures until $executions identical executions", ({ executions, expected }) => {
    const input = sequenceInput(["passed", ...Array<TestStatus>(executions).fill("failed")]);
    input.options.algorithm = "retry-failure-rate";
    input.storeData.historyDataPoints.forEach((point) => {
      const result = point.testResults.sequence!;
      result.retries = result.status === "failed" ? ["failed"] : [];
    });
    const current = input.storeData.testResults[0];
    current.retries = [{ ...current, id: "retry", status: "failed" }];

    const chart = generateStabilityDistributionChart(input);

    expect(chart.data.map((group) => ({ label: chart.keys[group.id], rate: group.stabilityRate }))).toEqual(expected);
  });

  it.each([
    { name: "clean passes", attempts: ["passed"], expected: [] },
    { name: "uniform retry failures", attempts: ["failed", "failed"], expected: [] },
    { name: "uniform broken outcomes", attempts: ["broken", "broken"], expected: [] },
    { name: "retry recoveries", attempts: ["failed", "passed"], expected: [{ label: "Sequence", rate: 0 }] },
    { name: "mixed failures", attempts: ["failed", "broken"], expected: [{ label: "Sequence", rate: 0 }] },
  ] as { name: string; attempts: TestStatus[]; expected: { label: string; rate: number }[] }[])(
    "assesses five identical $name executions",
    ({ attempts, expected }) => {
      const input = sequenceInput(Array<TestStatus>(5).fill(attempts.at(-1)!));
      input.options.algorithm = "retry-failure-rate";
      input.storeData.historyDataPoints.forEach((point) => {
        point.testResults.sequence!.retries = attempts.slice(0, -1);
      });
      const current = input.storeData.testResults[0];
      current.retries = attempts
        .slice(0, -1)
        .reverse()
        .map((status, index) => ({ ...current, id: `retry-${index}`, status }));

      const chart = generateStabilityDistributionChart(input);

      expect(chart.data.map((group) => ({ label: chart.keys[group.id], rate: group.stabilityRate }))).toEqual(expected);
    },
  );
});

describe("stability scenarios", () => {
  it("Example 1: an empty significant sequence is unassessed", () => {
    const statuses: TestStatus[] = [];
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data).toEqual([]);
  });

  it("Example 2: a single passed execution is unassessed", () => {
    const input = sequenceInput(["passed"]);

    const result = generateStabilityDistributionChart(input);

    expect(result.data).toEqual([]);
  });

  it("Example 3: consecutive passed outcomes at the end are stable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(100);
  });

  it("Example 4: one change after a passed stabilization block is stable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(100);
  });

  it("Example 5: a single recovered failure interval is stable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(100);
  });

  it("Example 6: multiple changes without stabilization are unstable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(0);
  });

  it("Example 7: repeated changes after a failed stabilization block are unstable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(0);
  });

  it("a single recovered broken interval is stable", () => {
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
    const input = sequenceInput(statuses);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(100);
  });
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
      options: { type: ChartType.StabilityDistribution, title: "Feature stability", threshold: 85 },
      storeData: createStoreData({}),
    });

    expect(result.title).toBe("Feature stability");
    expect(result.threshold).toBe(85);
  });

  it("should group by feature label and compute stable test percentage", () => {
    const retryHash = "hid-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status: "passed" }) },
        }),
        createHistoryDataPoint({
          uuid: "run-2",
          timestamp: 2000,
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }) },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          retryHash,
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution, groupBy: "feature", limit: 5, stabilizationPeriod: 2 },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].stabilityRate).toBe(100);
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
            h1: createHistoryTestResult({ retryHash: "h1", status: "passed" }),
            h2: createHistoryTestResult({ retryHash: "h2", status: "passed" }),
          },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          retryHash: "h1",
          labels: [{ name: "feature", value: "Auth" }],
        }),
        createTestResult({
          id: "tr-2",
          status: "passed",
          retryHash: "h2",
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

  it("should classify the Example 6 group as unstable", () => {
    const retryHash = "hid-1";
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
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status }) },
        }),
      ),
      testResults: [
        createTestResult({
          id: "tr-1",
          status: statuses[statuses.length - 1],
          retryHash,
          labels: [{ name: "feature", value: "Flaky" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].stabilityRate).toBe(0);
  });

  it("should use only the most recent contiguous history block when test is absent in a point", () => {
    const retryHash = "hid-1";
    const storeData = createStoreData({
      historyDataPoints: [
        createHistoryDataPoint({
          uuid: "run-1",
          timestamp: 1000,
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status: "passed" }) },
        }),
        createHistoryDataPoint({ uuid: "run-2", timestamp: 2000, testResults: {} }),
        createHistoryDataPoint({
          uuid: "run-3",
          timestamp: 3000,
          testResults: { [retryHash]: createHistoryTestResult({ retryHash, status: "failed" }) },
        }),
      ],
      testResults: [
        createTestResult({
          id: "tr-1",
          status: "passed",
          retryHash,
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution, limit: 5, stabilizationPeriod: 3 },
      storeData,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].stabilityRate).toBe(100);
  });
});

const assessmentData = (tests: { id: string; feature: string; stable?: boolean }[]): AllureChartsStoreData =>
  createStoreData({
    historyDataPoints: Array.from({ length: 4 }, (_, index) =>
      createHistoryDataPoint({
        uuid: `run-${index}`,
        timestamp: 1000 + index,
        testResults: Object.fromEntries(
          tests
            .filter((test) => test.stable !== undefined)
            .map((test) => [
              test.id,
              createHistoryTestResult({
                retryHash: test.id,
                status: test.stable || index % 2 === 0 ? "passed" : "failed",
              }),
            ]),
        ),
      }),
    ),
    testResults: tests.map((test) =>
      createTestResult({
        id: `${test.id}-current`,
        retryHash: test.id,
        labels: [{ name: "feature", value: test.feature }],
      }),
    ),
  });

describe("stability aggregation", () => {
  it("counts assessed tests independently for each group", () => {
    const storeData = assessmentData([
      { id: "a1", feature: "Auth", stable: true },
      { id: "a2", feature: "Auth", stable: true },
      { id: "a3", feature: "Auth", stable: false },
      { id: "a4", feature: "Auth" },
      { id: "b1", feature: "Billing", stable: true },
      { id: "b2", feature: "Billing", stable: true },
      { id: "b3", feature: "Billing" },
      { id: "u1", feature: "Unassessed" },
    ]);

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(Object.fromEntries(result.data.map((row) => [result.keys[row.id], row.stabilityRate]))).toEqual({
      Auth: 66.66,
      Billing: 100,
    });
  });

  it.each([
    [57, 100, 57],
    [58, 100, 58],
    [1, 3, 33.33],
  ])("reports %i stable tests out of %i as %s percent", (stable, total, rate) => {
    const storeData = assessmentData(
      Array.from({ length: total }, (_, index) => ({
        id: `${index}`,
        feature: "Auth",
        stable: index < stable,
      })),
    );

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(result.data[0].stabilityRate).toBe(rate);
  });

  it("assesses passing tests independently of the main flaky badge", () => {
    const input = sequenceInput(["passed", "failed", "passed", "failed", "passed"]);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(0);
    expect(input.storeData.testResults[0].flaky).toBe(false);
  });

  it("leaves a test unassessed after the latest run omits it", () => {
    const input = sequenceInput(["passed", "failed", "passed", "failed", "passed"]);
    input.storeData.historyDataPoints.push(createHistoryDataPoint({ timestamp: 2000 }));

    const result = generateStabilityDistributionChart(input);

    expect(result.data).toEqual([]);
    expect(result.keys).toEqual({});
  });

  it("uses newest executions without reordering supplied history", () => {
    const input = sequenceInput(["passed", "passed", "broken", "failed", "passed"]);
    input.options.limit = 2;
    const snapshot = structuredClone(input.storeData.historyDataPoints);

    const result = generateStabilityDistributionChart(input);

    expect(result.data[0].stabilityRate).toBe(0);
    expect(input.storeData.historyDataPoints).toEqual(snapshot);
  });

  it("counts explicitly reported flaky tests without history or a retry hash", () => {
    const storeData = createStoreData({
      testResults: [
        createTestResult({
          sourceMetadata: { readerId: "test", metadata: {}, reportedFlaky: true },
          labels: [{ name: "feature", value: "Auth" }],
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution },
      storeData,
    });

    expect(result.data[0].stabilityRate).toBe(0);
  });

  it("disables the chart with a zero limit", () => {
    const input = sequenceInput(["failed", "broken", "failed"]);
    input.options.limit = 0;

    const result = generateStabilityDistributionChart(input);

    expect(result.data).toEqual([]);
    expect(result.keys).toEqual({});
  });

  it("retains full identity context when displaying only selected groups", () => {
    const sourceMetadata = { readerId: "test", metadata: {}, legacyHistoryId: "legacy" };
    const current = createTestResult({
      retryHash: "canonical",
      sourceMetadata,
      labels: [{ name: "feature", value: "Auth" }],
    });
    const other = createTestResult({ id: "other", retryHash: "other-canonical", sourceMetadata });
    const storeData = createStoreData({
      testResults: [current],
      allTestResults: [current, other],
      historyDataPoints: [
        createHistoryDataPoint({
          testResults: { legacy: createHistoryTestResult({ retryHash: "legacy", status: "passed" }) },
        }),
      ],
    });

    const result = generateStabilityDistributionChart({
      options: { type: ChartType.StabilityDistribution, groupValues: ["Auth"] },
      storeData,
    });

    expect(result.data).toEqual([]);
  });
});
