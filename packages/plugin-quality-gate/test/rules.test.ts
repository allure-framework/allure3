import { type KnownTestFailure, TestResult } from "@allurereport/core-api";
import { AllureStore } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import { QualityGateRuleContext } from "../src/model.js";
import { maxFailuresRule, minTestsCountRule, successRateRule } from "../src/rules.js";

const createTestResult = (
  id: string,
  status: "passed" | "failed" | "broken" | "skipped" | "unknown",
  historyId?: string,
): TestResult => ({
  id,
  name: `Test ${id}`,
  status,
  historyId,
  flaky: false,
  muted: false,
  known: false,
  hidden: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: {
    readerId: "mock",
    metadata: {},
  },
});

describe("relative", () => {
  describe("maxFailuresRule", () => {
    it("should pass when failures count is less than expected (without state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "failed"),
      ];
      const expected = 2;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };
      const result = await maxFailuresRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(1);
      expect(result.expected).toBe(expected);
    });

    it("should fail when failures count is greater than expected (without state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed"),
        createTestResult("3", "failed"),
      ];
      const expected = 1;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };
      const result = await maxFailuresRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(2);
      expect(result.expected).toBe(expected);
    });

    it("should pass when failures count plus state is less than expected (with state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "failed"),
      ];
      const expected = 3;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 1,
      };
      const result = await maxFailuresRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(1);
      expect(result.expected).toBe(expected);
    });

    it("should fail when failures count plus state is greater than expected (with state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed"),
        createTestResult("3", "failed"),
      ];
      const expected = 3;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 2,
      };
      const result = await maxFailuresRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(2);
      expect(result.expected).toBe(expected);
    });

    it("should filter out known issues", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed", "known-issue-1"),
        createTestResult("3", "failed"),
      ];
      const expected = 1;
      const context: QualityGateRuleContext = {
        state: 0,
        rulesState: {},
        store: { allKnownIssues: async () => [{ historyId: "known-issue-1" }] } as AllureStore,
      };
      const result = await maxFailuresRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(1);
      expect(result.expected).toBe(expected);
    });
  });
});

describe("absolute", () => {
  describe("minTestsCountRule", () => {
    it("should pass when test count is greater than expected (without state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "failed"),
      ];
      const expected = 2;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };

      const result = await minTestsCountRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(3);
      expect(result.expected).toBe(expected);
    });

    it("should fail when test count is less than expected (without state)", async () => {
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const expected = 2;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };
      const result = await minTestsCountRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(1);
      expect(result.expected).toBe(expected);
    });

    it("should pass when test count is greater than expected (with state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "passed"),
      ];
      const expected = 3;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 2,
      };
      const result = await minTestsCountRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(3);
      expect(result.expected).toBe(expected);
    });

    it("should fail when test count is less than expected (with state)", async () => {
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const expected = 3;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 1,
      };
      const result = await minTestsCountRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(1);
      expect(result.expected).toBe(expected);
    });
  });

  describe("successRateRule", () => {
    it("should pass when success rate is greater than expected (without state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "failed"),
      ];
      const expected = 0.6;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };
      const result = await successRateRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(2 / 3);
      expect(result.expected).toBe(expected);
    });

    it("should fail when success rate is less than expected (without state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed"),
        createTestResult("3", "failed"),
      ];
      const expected = 0.6;
      const context: QualityGateRuleContext = {
        state: undefined,
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
      };
      const result = await successRateRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(1 / 3);
      expect(result.expected).toBe(expected);
    });

    it("should pass when success rate is greater than expected (with state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "passed"),
        createTestResult("3", "failed"),
      ];
      const expected = 0.6;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 0.7,
      };
      const result = await successRateRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(2 / 3);
      expect(result.expected).toBe(expected);
    });

    it("should fail when success rate is less than expected (with state)", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed"),
        createTestResult("3", "failed"),
      ];
      const expected = 0.6;
      const context: QualityGateRuleContext = {
        rulesState: {},
        store: { allKnownIssues: async () => [] as KnownTestFailure[] } as AllureStore,
        state: 0.5,
      };
      const result = await successRateRule.validate(testResults, expected, context);

      expect(result.success).toBe(false);
      expect(result.actual).toBe(1 / 3);
      expect(result.expected).toBe(expected);
    });

    it("should filter out known issues", async () => {
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed", "known-issue-1"),
        createTestResult("3", "failed"),
      ];
      const expected = 0.5;
      const context: QualityGateRuleContext = {
        state: 0,
        rulesState: {},
        store: { allKnownIssues: async () => [{ historyId: "known-issue-1" }] } as AllureStore,
      };
      const result = await successRateRule.validate(testResults, expected, context);

      expect(result.success).toBe(true);
      expect(result.actual).toBe(0.5);
      expect(result.expected).toBe(expected);
    });
  });
});
