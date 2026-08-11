import { type TestResult, type TestStatus, fallbackTestCaseIdLabelName } from "@allurereport/core-api";
import { type QualityGateRuleState, md5 } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  allTestsContainEnvRule,
  environmentsTestedRule,
  maxDurationRule,
  maxFailuresRule,
  minTestsCountRule,
  metricMaxDeltaPercentRule,
  metricMaxDeltaRule,
  metricMaxRule,
  metricMinRule,
  successRateRule,
} from "../../src/qualityGate/rules.js";

const createTestResult = (
  id: string,
  status: TestStatus,
  historyId?: string,
  duration?: number,
  environment?: string,
  labels: TestResult["labels"] = [],
  parameters: TestResult["parameters"] = [],
) =>
  ({
    id,
    name: `Test ${id}`,
    historyId,
    status,
    duration,
    environment,
    flaky: false,
    muted: false,
    isRetry: false,
    labels,
    parameters,
    links: [],
    steps: [],
    sourceMetadata: { readerId: "", metadata: {} },
  }) as TestResult;

beforeEach(async () => {
  await epic("coverage");
  await feature("quality-gates");
  await story("rules");
  await label("coverage", "quality-gates");
  vi.clearAllMocks();
});

describe("maxFailuresRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value, testResults) => setState(value, testResults),
  };

  it("should pass when failures count is less than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "passed"),
      createTestResult("3", "failed"),
    ];
    const expected = 2;
    const result = await maxFailuresRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(1);
    expect(result.testResults).toEqual(["3"]);
    expect(setState).toHaveBeenCalledWith(1, ["3"]);
  });

  it("should fail when failures count is greater than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "failed"),
      createTestResult("3", "failed"),
    ];
    const expected = 1;
    const result = await maxFailuresRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(2);
    expect(result.testResults).toEqual(["2", "3"]);
    expect(setState).toHaveBeenCalledWith(2, ["2", "3"]);
  });

  it("should count an unresolved failure", async () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const testResults: TestResult[] = [
      createTestResult("1", "failed", "new-history-id", undefined, undefined, [
        { name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId },
      ]),
    ];

    const result = await maxFailuresRule.validate({
      trs: testResults,
      expected: 0,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
    expect(result.testResults).toEqual(["1"]);
  });
});

describe("minTestsCountRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value, testResults) => setState(value, testResults),
  };

  it("should pass when test count is greater than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "passed"),
      createTestResult("3", "failed"),
    ];
    const expected = 2;
    const result = await minTestsCountRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(3);
    expect(setState).toHaveBeenCalledWith(3, []);
  });

  it("should fail when test count is less than expected", async () => {
    const testResults: TestResult[] = [createTestResult("1", "passed")];
    const expected = 2;
    const result = await minTestsCountRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
    expect(setState).toHaveBeenCalledWith(1, []);
  });
});

describe("successRateRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<{ totalCount: number; passedCount: number }> = {
    getResult: () => ({ totalCount: 0, passedCount: 0 }),
    setResult: (value, testResults) => setState(value, testResults),
  };

  it("should pass when success rate is greater than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "passed"),
      createTestResult("3", "failed"),
    ];
    const expected = 0.6;
    const result = await successRateRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(2 / 3);
    expect(result.testResults).toEqual(["3"]);
    expect(setState).toHaveBeenCalledWith({ totalCount: 3, passedCount: 2 }, ["3"]);
  });

  it("should fail when success rate is less than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "failed"),
      createTestResult("3", "failed"),
    ];
    const expected = 0.6;
    const result = await successRateRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1 / 3);
    expect(result.testResults).toEqual(["2", "3"]);
    expect(setState).toHaveBeenCalledWith({ totalCount: 3, passedCount: 1 }, ["2", "3"]);
  });

  it("should fail empty suite with zero success rate", async () => {
    const result = await successRateRule.validate({
      trs: [],
      expected: 1,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(0);
  });

  it("should count an unresolved failure", async () => {
    const fallbackTestCaseId = md5("legacy-test-case-id");
    const testResults: TestResult[] = [
      createTestResult("1", "failed", "new-history-id", undefined, undefined, [
        { name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId },
      ]),
    ];

    const result = await successRateRule.validate({
      trs: testResults,
      expected: 1,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(0);
    expect(result.testResults).toEqual(["1"]);
  });
});

describe("maxDurationRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value, testResults) => setState(value, testResults),
  };

  it("should pass when max duration is less than expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "passed", undefined, 200),
      createTestResult("3", "failed", undefined, 150),
    ];
    const expected = 300;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(200);
    expect(result.testResults).toEqual([]);
  });

  it("should fail when max duration exceeds expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "passed", undefined, 500),
      createTestResult("3", "failed", undefined, 150),
    ];
    const expected = 300;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(500);
    expect(result.testResults).toEqual(["2"]);
  });

  it("should pass when max duration equals expected", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "passed", undefined, 300),
      createTestResult("3", "failed", undefined, 150),
    ];
    const expected = 300;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(300);
  });

  it("should handle tests with no duration as 0", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "passed"),
      createTestResult("3", "failed", undefined, 50),
    ];
    const expected = 150;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(100);
  });

  it("should handle all tests with no duration", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "passed"),
      createTestResult("3", "failed"),
    ];
    const expected = 100;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0);
  });

  it("should use every result provided to the rule", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "failed", "known-issue-1", 500),
      createTestResult("3", "failed", undefined, 150),
    ];
    const expected = 300;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(500);
    expect(result.testResults).toEqual(["2"]);
  });
});

describe("allTestsContainEnvRule", () => {
  const state: QualityGateRuleState<number> = {
    getResult: () => undefined,
    setResult: () => {},
  };

  it("should pass when all tests have the required environment", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed", undefined, undefined, "staging"),
    ];
    const result = await allTestsContainEnvRule.validate({
      trs: testResults,
      expected: "staging",
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0);
  });

  it("should fail when some tests have different environment", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed", undefined, undefined, "prod"),
    ];
    const result = await allTestsContainEnvRule.validate({
      trs: testResults,
      expected: "staging",
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
    expect(result.testResults).toEqual(["2"]);
  });

  it("should fail when some tests have no environment", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed"),
    ];
    const result = await allTestsContainEnvRule.validate({
      trs: testResults,
      expected: "staging",
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
    expect(result.testResults).toEqual(["2"]);
  });

  it("should pass when no tests and expected env is given", async () => {
    const result = await allTestsContainEnvRule.validate({
      trs: [],
      expected: "staging",
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0);
    expect(result.testResults).toEqual([]);
  });
});

describe("environmentsTestedRule", () => {
  it("should pass when all required environments are present in the run", async () => {
    const state: QualityGateRuleState<string[]> = {
      getResult: () => undefined,
      setResult: () => {},
    };

    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed", undefined, undefined, "prod"),
    ];
    const result = await environmentsTestedRule.validate({
      trs: testResults,
      expected: ["staging", "prod"],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toEqual([]);
  });

  it("should fail when some required environments are missing", async () => {
    const state: QualityGateRuleState<string[]> = {
      getResult: () => undefined,
      setResult: () => {},
    };

    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed", undefined, undefined, "staging"),
    ];
    const result = await environmentsTestedRule.validate({
      trs: testResults,
      expected: ["staging", "prod"],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toEqual(["prod"]);
  });

  it("should fail when all required environments are missing", async () => {
    const state: QualityGateRuleState<string[]> = {
      getResult: () => undefined,
      setResult: () => {},
    };

    const testResults: TestResult[] = [createTestResult("1", "passed", undefined, undefined, "dev")];
    const result = await environmentsTestedRule.validate({
      trs: testResults,
      expected: ["staging", "prod"],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toEqual(["staging", "prod"]);
  });

  it("should pass when expected list is empty", async () => {
    const state: QualityGateRuleState<string[]> = {
      getResult: () => undefined,
      setResult: () => {},
    };

    const result = await environmentsTestedRule.validate({
      trs: [createTestResult("1", "passed", undefined, undefined, "staging")],
      expected: [],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toEqual([]);
  });

  it("should accumulate tested environments across multiple batches using state", async () => {
    let stored: string[] | undefined;
    const setState = vi.fn((value: string[]) => {
      stored = value;
    });

    const state: QualityGateRuleState<string[]> = {
      getResult: () => stored,
      setResult: setState,
    };

    const expected = ["staging", "prod"];

    // First batch: only "staging" is present, so rule should fail
    const firstBatch: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed", undefined, undefined, "staging"),
    ];

    const firstResult = await environmentsTestedRule.validate({
      trs: firstBatch,
      expected,
      state,
    });

    expect(firstResult.success).toBe(false);
    expect(firstResult.actual).toEqual(["prod"]);
    expect(setState).toHaveBeenLastCalledWith(["staging"], []);

    // Second batch: only "prod" is present, but state already contains "staging"
    const secondBatch: TestResult[] = [
      createTestResult("3", "passed", undefined, undefined, "prod"),
      createTestResult("4", "passed", undefined, undefined, "prod"),
    ];

    const secondResult = await environmentsTestedRule.validate({
      trs: secondBatch,
      expected,
      state,
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.actual).toEqual([]);
    expect(setState).toHaveBeenLastCalledWith(expect.arrayContaining(["staging", "prod"]), []);
  });
});

describe("metric quality gate rules", () => {
  const state: QualityGateRuleState<never> = {
    getResult: () => undefined,
    setResult: () => {},
  };
  const basePayload = {
    trs: [] as TestResult[],
    knownIssues: [] as KnownTestFailure[],
    state,
  };

  it("should validate maximum metric threshold against the current average", async () => {
    await expect(
      metricMaxRule.validate({
        ...basePayload,
        expected: { key: "bundle.size", value: 10 },
        metrics: [
          { id: "1", key: "bundle.size", value: 8, start: 0, stop: 1 },
          { id: "2", key: "bundle.size", value: 12, start: 1, stop: 2 },
        ],
      }),
    ).resolves.toEqual({
      success: true,
      actual: 10,
      testResults: [],
    });
  });

  it("should fail missing metrics instead of silently passing", async () => {
    await expect(
      metricMinRule.validate({
        ...basePayload,
        expected: { key: "bundle.size", value: 1 },
        metrics: [],
      }),
    ).resolves.toEqual({
      success: false,
      actual: undefined,
      testResults: [],
    });
  });

  it("should compare the current metric against the latest previous history point with that key", async () => {
    await expect(
      metricMaxDeltaRule.validate({
        ...basePayload,
        expected: { key: "bundle.size", value: 5 },
        metrics: [{ id: "1", key: "bundle.size", value: 112, start: 0, stop: 1 }],
        currentReportUuid: "current",
        history: [
          {
            uuid: "current",
            name: "current",
            timestamp: 3,
            knownTestCaseIds: [],
            testResults: {},
            metrics: { "bundle.size": 112 },
          },
          {
            uuid: "new",
            name: "new",
            timestamp: 2,
            knownTestCaseIds: [],
            testResults: {},
            metrics: { "bundle.size": 110 },
          },
          {
            uuid: "old",
            name: "old",
            timestamp: 1,
            knownTestCaseIds: [],
            testResults: {},
            metrics: { "bundle.size": 100 },
          },
        ],
      }),
    ).resolves.toEqual({
      success: true,
      actual: 2,
      testResults: [],
    });
  });

  it("should pass metric delta rules when no previous baseline exists", async () => {
    await expect(
      metricMaxDeltaRule.validate({
        ...basePayload,
        expected: { key: "bundle.size", value: 5 },
        metrics: [{ id: "1", key: "bundle.size", value: 112, start: 0, stop: 1 }],
        history: [],
      }),
    ).resolves.toEqual({
      success: true,
      actual: undefined,
      testResults: [],
    });
  });

  it("should fail when the percent delta exceeds the configured threshold", async () => {
    await expect(
      metricMaxDeltaPercentRule.validate({
        ...basePayload,
        expected: { key: "bundle.size", value: 10 },
        metrics: [{ id: "1", key: "bundle.size", value: 120, start: 0, stop: 1 }],
        history: [
          {
            uuid: "previous",
            name: "previous",
            timestamp: 1,
            knownTestCaseIds: [],
            testResults: {},
            metrics: { "bundle.size": 100 },
          },
        ],
      }),
    ).resolves.toEqual({
      success: false,
      actual: 20,
      testResults: [],
    });
  });

  it("should use configured metric title and unit in messages", () => {
    const message = metricMaxRule.message({
      actual: 12,
      expected: { key: "bundle.size", value: 10 },
      performance: {
        metrics: {
          "bundle.size": {
            title: "Bundle size",
            unit: "MB",
            better: "lower",
          },
        },
      },
    });

    expect(message).toContain("Bundle size");
    expect(message).toContain("12 MB");
  });
});
