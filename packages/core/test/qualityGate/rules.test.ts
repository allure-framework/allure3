import type { KnownTestFailure, TestResult, TestStatus } from "@allurereport/core-api";
import type { QualityGateRuleState } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maxDurationRule, maxFailuresRule, minTestsCountRule, successRateRule } from "../../src/qualityGate/rules.js";

const createTestResult = (id: string, status: TestStatus, historyId?: string, duration?: number) =>
  ({
    id,
    name: `Test ${id}`,
    historyId,
    status,
    duration,
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
