import type { KnownTestFailure, TestResult, TestStatus } from "@allurereport/core-api";
import type { QualityGateRuleState } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  allTestsContainEnvRule,
  environmentsTestedRule,
  maxDurationRule,
  maxFailuresRule,
  minTestsCountRule,
  successRateRule,
} from "../../src/qualityGate/rules.js";

const createTestResult = (
  id: string,
  status: TestStatus,
  historyId?: string,
  duration?: number,
  environment?: string,
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
    known: false,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: "", metadata: {} },
  }) as TestResult;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("maxFailuresRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value) => setState(value),
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(1);
    expect(setState).toHaveBeenCalledWith(1);
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(2);
    expect(setState).toHaveBeenCalledWith(2);
  });

  it("should filter out known issues", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "failed", "known-issue-1"),
      createTestResult("3", "failed"),
    ];
    const expected = 1;
    const result = await maxFailuresRule.validate({
      trs: testResults,
      expected,
      knownIssues: [{ historyId: "known-issue-1" }] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(1);
  });
});

describe("minTestsCountRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value) => setState(value),
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(3);
    expect(setState).toHaveBeenCalledWith(3);
  });

  it("should fail when test count is less than expected", async () => {
    const testResults: TestResult[] = [createTestResult("1", "passed")];
    const expected = 2;
    const result = await minTestsCountRule.validate({
      trs: testResults,
      expected,
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
    expect(setState).toHaveBeenCalledWith(1);
  });
});

describe("successRateRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value) => setState(value),
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(2 / 3);
    expect(setState).not.toHaveBeenCalled();
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1 / 3);
    expect(setState).not.toHaveBeenCalled();
  });

  it("should filter out known issues", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed"),
      createTestResult("2", "failed", "known-issue-1"),
      createTestResult("3", "failed"),
    ];
    const expected = 0.5;
    const result = await successRateRule.validate({
      trs: testResults,
      expected,
      knownIssues: [{ historyId: "known-issue-1" }] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0.5);
    expect(setState).not.toHaveBeenCalled();
  });
});

describe("maxDurationRule", () => {
  const setState = vi.fn();
  const state: QualityGateRuleState<number> = {
    getResult: () => 0,
    setResult: (value) => setState(value),
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(200);
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(500);
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
      knownIssues: [] as KnownTestFailure[],
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
      knownIssues: [] as KnownTestFailure[],
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
      knownIssues: [] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0);
  });

  it("should not filter out known issues", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, 100),
      createTestResult("2", "failed", "known-issue-1", 500),
      createTestResult("3", "failed", undefined, 150),
    ];
    const expected = 300;
    const result = await maxDurationRule.validate({
      trs: testResults,
      expected,
      knownIssues: [{ historyId: "known-issue-1" }] as KnownTestFailure[],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(500);
  });
});

describe("allTestsContainEnvRule", () => {
  const state: QualityGateRuleState<string> = {
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
      knownIssues: [],
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
      knownIssues: [],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
  });

  it("should fail when some tests have no environment", async () => {
    const testResults: TestResult[] = [
      createTestResult("1", "passed", undefined, undefined, "staging"),
      createTestResult("2", "passed"),
    ];
    const result = await allTestsContainEnvRule.validate({
      trs: testResults,
      expected: "staging",
      knownIssues: [],
      state,
    });

    expect(result.success).toBe(false);
    expect(result.actual).toBe(1);
  });

  it("should pass when no tests and expected env is given", async () => {
    const result = await allTestsContainEnvRule.validate({
      trs: [],
      expected: "staging",
      knownIssues: [],
      state,
    });

    expect(result.success).toBe(true);
    expect(result.actual).toBe(0);
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
      knownIssues: [],
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
      knownIssues: [],
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
      knownIssues: [],
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
      knownIssues: [],
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
      knownIssues: [],
      state,
    });

    expect(firstResult.success).toBe(false);
    expect(firstResult.actual).toEqual(["prod"]);
    expect(setState).toHaveBeenLastCalledWith(["staging"]);

    // Second batch: only "prod" is present, but state already contains "staging"
    const secondBatch: TestResult[] = [
      createTestResult("3", "passed", undefined, undefined, "prod"),
      createTestResult("4", "passed", undefined, undefined, "prod"),
    ];

    const secondResult = await environmentsTestedRule.validate({
      trs: secondBatch,
      expected,
      knownIssues: [],
      state,
    });

    expect(secondResult.success).toBe(true);
    expect(secondResult.actual).toEqual([]);
    expect(setState).toHaveBeenLastCalledWith(expect.arrayContaining(["staging", "prod"]));
  });
});
