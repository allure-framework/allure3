import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { QualityGateConfig, QualityGateRule, QualityGateValidationResult } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QualityGate, QualityGateState } from "../../src/qualityGate/qualityGate.js";

const createTestResult = (id: string, status: TestStatus, historyId?: string) =>
  ({
    id,
    name: `Test ${id}`,
    status,
    historyId,
  }) as TestResult;
const createValidationResult = (
  success: boolean,
  rule: string,
  actual: any,
  expected: any,
  message: string,
): QualityGateValidationResult => ({
  success,
  rule,
  actual,
  expected,
  message,
});

describe("QualityGateState", () => {
  it("should return undefined for unknown rule id", () => {
    const state = new QualityGateState();

    expect(state.getRuleResult("non-existent" as string)).toBeUndefined();
  });

  it("should set and get a value for a rule id", () => {
    const state = new QualityGateState();

    state.setRuleResult("rule/a", 123);

    expect(state.getRuleResult("rule/a")).toBe(123);
  });
});

describe("QualityGate", () => {
  describe("stringifyValidationResults", () => {
    let qualityGate: QualityGate;

    beforeEach(() => {
      const config: QualityGateConfig = {};

      qualityGate = new QualityGate(config);
    });

    it("should return empty string for empty results", () => {
      const results: QualityGateValidationResult[] = [];
      const result = qualityGate.stringifyValidationResults(results);

      expect(result).toBe("");
    });

    it("should format single validation result", () => {
      const results: QualityGateValidationResult[] = [
        createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
      ];
      const result = qualityGate.stringifyValidationResults(results);

      expect(result).toContain("Quality Gate failed with following issues:");
      expect(result).toContain("Maximum number of failed tests 2 is more, than expected 1");
      expect(result).toContain("maxFailures");
      expect(result).toContain("1 quality gate rules have been failed.");
    });

    it("should format multiple validation results", () => {
      const results: QualityGateValidationResult[] = [
        createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
        createValidationResult(false, "minTestsCount", 1, 2, "Minimum number of tests 1 is less, than expected 2"),
      ];
      const result = qualityGate.stringifyValidationResults(results);

      expect(result).toContain("Quality Gate failed with following issues:");
      expect(result).toContain("Maximum number of failed tests 2 is more, than expected 1");
      expect(result).toContain("Minimum number of tests 1 is less, than expected 2");
      expect(result).toContain("maxFailures");
      expect(result).toContain("minTestsCount");
      expect(result).toContain("2 quality gate rules have been failed.");
    });
  });

  describe("createQualityGateTestErrors", () => {
    let qualityGate: QualityGate;

    beforeEach(() => {
      qualityGate = new QualityGate({});
    });

    it("should return empty array for empty results", () => {
      const results: QualityGateValidationResult[] = [];
      const errors = qualityGate.createQualityGateTestErrors(results);

      expect(errors).toEqual([]);
    });

    it("should convert single validation result to test error", () => {
      const results: QualityGateValidationResult[] = [
        createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
      ];
      const errors = qualityGate.createQualityGateTestErrors(results);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        message: "Quality Gate (maxFailures): Maximum number of failed tests 2 is more, than expected 1",
        actual: 2,
        expected: 1,
      });
    });

    it("should convert multiple validation results to test errors", () => {
      const results: QualityGateValidationResult[] = [
        createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
        createValidationResult(false, "minTestsCount", 1, 2, "Minimum number of tests 1 is less, than expected 2"),
      ];
      const errors = qualityGate.createQualityGateTestErrors(results);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        message: "Quality Gate (maxFailures): Maximum number of failed tests 2 is more, than expected 1",
        actual: 2,
        expected: 1,
      });
      expect(errors[1]).toEqual({
        message: "Quality Gate (minTestsCount): Minimum number of tests 1 is less, than expected 2",
        actual: 1,
        expected: 2,
      });
    });
  });

  describe("validate", () => {
    it("should return empty array when no rules are defined", async () => {
      const config: QualityGateConfig = {
        rules: [],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toEqual([]);
      expect(fastFailed).toBe(false);
    });

    it("should set fastFailed to true when a rule with fastFail: true fails", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 3, fastFail: true }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].rule).toBe("mockRule");
      expect(fastFailed).toBe(true);
    });

    it("shouldn't call subsequent rulesets when a rule with fastFail: true fails", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule 1 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
        }),
      };
      const mockRule2: QualityGateRule<number> = {
        rule: "mockRule2",
        message: ({ actual, expected }) => `Mock rule 2 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 10,
          expected: 5,
        }),
      };
      const validateSpy1 = vi.spyOn(mockRule1, "validate");
      const validateSpy2 = vi.spyOn(mockRule2, "validate");
      const config: QualityGateConfig = {
        rules: [{ mockRule1: 3, fastFail: true }, { mockRule2: 5 }],
        use: [mockRule1, mockRule2],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(validateSpy1).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("mockRule1");
      expect(fastFailed).toBe(true);
      expect(validateSpy2).not.toHaveBeenCalled();
    });

    it("shouldn't call subsequent rules in the same ruleset when a rule with fastFail: true fails", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule 1 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
        }),
      };
      const mockRule2: QualityGateRule<number> = {
        rule: "mockRule2",
        message: ({ actual, expected }) => `Mock rule 2 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 10,
          expected: 5,
        }),
      };
      const validateSpy1 = vi.spyOn(mockRule1, "validate");
      const validateSpy2 = vi.spyOn(mockRule2, "validate");
      const config: QualityGateConfig = {
        rules: [
          {
            mockRule1: 3,
            mockRule2: 5,
            fastFail: true,
          },
        ],
        use: [mockRule1, mockRule2],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(validateSpy1).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("mockRule1");
      expect(fastFailed).toBe(true);
      expect(validateSpy2).not.toHaveBeenCalled();
    });

    it("should validate test results against rules and return failures", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].rule).toBe("mockRule");
      expect(results[0].actual).toBe(5);
      expect(results[0].expected).toBe(3);
      expect(results[0].message).toBe("Mock rule failed with 5 vs 3");
      expect(fastFailed).toBe(false);
    });

    it("should validate test results against rules and return empty array when all rules pass", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: true,
          actual: 2,
          expected: 3,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "passed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toEqual([]);
      expect(fastFailed).toBe(false);
    });

    it("should re-use external state between validations", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async ({ state = 0 }) => ({
          success: true,
          actual: state + 1,
          expected: 3,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      };
      const validateSpy = vi.spyOn(mockRule, "validate");
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const qgState = new QualityGateState();

      await qualityGate.validate({
        state: qgState,
        trs: testResults,
        knownIssues: [],
      });
      const { fastFailed } = await qualityGate.validate({
        state: qgState,
        trs: testResults,
        knownIssues: [],
      });

      expect(validateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 1,
        }),
      );
      expect(fastFailed).toBe(false);
    });

    it("should work without external state and pass undefined state to rules", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRuleNoState",
        message: () => "ok",
        validate: async () => ({
          success: true,
          actual: 0,
          expected: 0,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRuleNoState: 0 }],
        use: [mockRule],
      };
      const validateSpy = vi.spyOn(mockRule, "validate");
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];

      await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });
      await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(validateSpy).toHaveBeenCalled();
      expect(validateSpy).toHaveBeenCalledTimes(2);
      expect(validateSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ state: undefined }));
      expect(validateSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ state: undefined }));
    });

    it("should throw error for unknown rule", async () => {
      const config: QualityGateConfig = {
        rules: [{ unknownRule: 3 }],
        use: [],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];

      await expect(
        qualityGate.validate({
          trs: testResults,
          knownIssues: [],
        }),
      ).rejects.toThrow(
        'Rule unknownRule is not provided. Make sure you have provided it in the "use" field of the quality gate config!',
      );
    });

    it("should use ruleset id in rule name when provided", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ id: "customId", mockRule: 3 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("customId/mockRule");
      expect(fastFailed).toBe(false);
    });

    it("should use default rules when no rules are provided in use", async () => {
      const config: QualityGateConfig = {
        rules: [{ maxFailures: 0 }],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
        knownIssues: [],
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("maxFailures");
      expect(fastFailed).toBe(false);
    });
  });
});
