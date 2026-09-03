import type { TestResult, TestStatus } from "@allurereport/core-api";
import type { QualityGateConfig, QualityGateRule, QualityGateValidationResult } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  QualityGate,
  QualityGateState,
  convertQualityGateResultsToTestErrors,
  filterFailedQualityGateResults,
  stringifyQualityGateResults,
} from "../../src/qualityGate/qualityGate.js";
import { minTestsCountRule } from "../../src/qualityGate/rules.js";

const createTestResult = (id: string, status: TestStatus, historyId?: string, isRetry = false) =>
  ({
    id,
    name: `Test ${id}`,
    status,
    historyId,
    isRetry,
  }) as TestResult;
// default rule messages are highlighted with ANSI codes whenever the terminal supports colors
const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[\\d+m`, "g");
const stripAnsi = (value: string) => value.replaceAll(ansiPattern, "");
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
  testResults: [],
});

beforeEach(async () => {
  await epic("coverage");
  await feature("quality-gates");
  await story("qualityGate");
  await label("coverage", "quality-gates");
});

describe("filterFailedQualityGateResults", () => {
  it("should keep failed results only", () => {
    const failed = createValidationResult(false, "maxFailures", 2, 1, "failed");
    const passed = createValidationResult(true, "minTestsCount", 2, 1, "passed");

    expect(filterFailedQualityGateResults([passed, failed])).toEqual([failed]);
  });

  it("should return empty array when every rule has been passed", () => {
    expect(filterFailedQualityGateResults([createValidationResult(true, "maxFailures", 0, 1, "passed")])).toEqual([]);
  });
});

describe("stringifyQualityGateResults", () => {
  it("should return empty string for empty results", () => {
    const results: QualityGateValidationResult[] = [];
    const result = stringifyQualityGateResults(results);

    expect(result).toBe("");
  });

  it("should format single validation result", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
    ];
    const result = stringifyQualityGateResults(results);

    expect(result).toContain("Quality Gate failed with following issues:");
    expect(result).toContain("Maximum number of failed tests 2 is more, than expected 1");
    expect(result).toContain("maxFailures");
    expect(result).toContain("1 quality gate rules have been failed.");
  });

  it("should return empty string when every rule has been passed", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(true, "maxFailures", 0, 1, "The number of failed tests 0 is within the threshold 1"),
    ];

    expect(stringifyQualityGateResults(results)).toBe("");
  });

  it("should omit passed rules from the formatted output", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(true, "minTestsCount", 2, 1, "The total number of tests 2 meets the threshold 1"),
      createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
    ];
    const result = stringifyQualityGateResults(results);

    expect(result).toContain("Maximum number of failed tests 2 is more, than expected 1");
    expect(result).not.toContain("The total number of tests 2 meets the threshold 1");
    expect(result).not.toContain("minTestsCount");
    expect(result).toContain("1 quality gate rules have been failed.");
  });

  it("should format multiple validation results", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
      createValidationResult(false, "minTestsCount", 1, 2, "Minimum number of tests 1 is less, than expected 2"),
    ];
    const result = stringifyQualityGateResults(results);

    expect(result).toContain("Quality Gate failed with following issues:");
    expect(result).toContain("Maximum number of failed tests 2 is more, than expected 1");
    expect(result).toContain("Minimum number of tests 1 is less, than expected 2");
    expect(result).toContain("maxFailures");
    expect(result).toContain("minTestsCount");
    expect(result).toContain("2 quality gate rules have been failed.");
  });
});

describe("convertQualityGateResultsToTestErrors", () => {
  it("should return empty array for empty results", () => {
    const results: QualityGateValidationResult[] = [];
    const errors = convertQualityGateResultsToTestErrors(results);

    expect(errors).toEqual([]);
  });

  it("should convert single validation result to test error", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
    ];
    const errors = convertQualityGateResultsToTestErrors(results);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "Quality Gate (maxFailures): Maximum number of failed tests 2 is more, than expected 1",
      actual: 2,
      expected: 1,
    });
  });

  it("should not convert passed validation results", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(true, "maxFailures", 0, 1, "The number of failed tests 0 is within the threshold 1"),
    ];

    expect(convertQualityGateResultsToTestErrors(results)).toEqual([]);
  });

  it("should convert multiple validation results to test errors", () => {
    const results: QualityGateValidationResult[] = [
      createValidationResult(false, "maxFailures", 2, 1, "Maximum number of failed tests 2 is more, than expected 1"),
      createValidationResult(false, "minTestsCount", 1, 2, "Minimum number of tests 1 is less, than expected 2"),
    ];
    const errors = convertQualityGateResultsToTestErrors(results);

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

describe("QualityGateState", () => {
  it("should return undefined for an unknown rule key", () => {
    const state = new QualityGateState();

    expect(state.getResult("nonExistingRule")).toBeUndefined();
  });

  it("should store and retrieve values by rule key", () => {
    const state = new QualityGateState();

    state.setResult("ruleA", 42);
    state.setResult("ruleB", "value");

    expect(state.getResult("ruleA")).toBe(42);
    expect(state.getResult("ruleB")).toBe("value");
  });
});

describe("QualityGate", () => {
  describe("validate", () => {
    it("should return empty array when no rules are defined", async () => {
      const config: QualityGateConfig = {
        rules: [],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toEqual([]);
      expect(fastFailed).toBe(false);
    });

    it("should validate test results against rules and return failures", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
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
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].rule).toBe("mockRule");
      expect(results[0].actual).toBe(5);
      expect(results[0].expected).toBe(3);
      expect(results[0].message).toBe("Mock rule failed with 5 vs 3");
      expect(results[0].testResults).toEqual([]);
      expect(fastFailed).toBe(false);
    });

    it("should populate evidence ids for maxFailures default rule", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0 }],
      });
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed"),
        createTestResult("3", "broken"),
        { ...createTestResult("4", "failed"), resolution: "muted" } as TestResult,
        { ...createTestResult("5", "broken"), resolution: "accepted" } as TestResult,
      ];

      const { results } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("maxFailures");
      expect(results[0].testResults).toEqual(["2", "3"]);
    });

    it("should populate evidence ids for maxDuration default rule", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxDuration: 10 }],
      });
      const testResults: TestResult[] = [
        { ...createTestResult("1", "passed"), duration: 10 } as TestResult,
        { ...createTestResult("2", "passed"), duration: 11 } as TestResult,
        { ...createTestResult("3", "failed"), duration: 20 } as TestResult,
      ];

      const { results } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("maxDuration");
      expect(results[0].testResults).toEqual(["2", "3"]);
    });

    it("should return empty evidence ids for default rules without direct evidence", async () => {
      const qualityGate = new QualityGate({
        rules: [{ minTestsCount: 2 }],
      });

      const { results } = await qualityGate.validate({
        trs: [createTestResult("1", "passed")],
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("minTestsCount");
      expect(results[0].testResults).toEqual([]);
    });

    it("should preserve passed environment values in failed results", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: vi.fn().mockResolvedValue({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
        }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      });

      const { results } = await qualityGate.validate({
        trs: [createTestResult("1", "passed")],
        environment: "foo/bar",
      });

      expect(results).toEqual([
        expect.objectContaining({
          environment: "foo/bar",
        }),
      ]);
      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "foo/bar",
        }),
      );
    });

    it("should report passed rules with their success message", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        successMessage: ({ actual, expected }) => `Mock rule passed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: true,
          actual: 2,
          expected: 3,
          testResults: [],
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
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].rule).toBe("mockRule");
      expect(results[0].actual).toBe(2);
      expect(results[0].expected).toBe(3);
      expect(results[0].message).toBe("Mock rule passed with 2 vs 3");
      expect(fastFailed).toBe(false);
    });

    it("should fall back to a generic message when a passed rule has no success message", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: true,
          actual: 2,
          testResults: [],
        }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      });

      const { results } = await qualityGate.validate({
        trs: [createTestResult("1", "passed")],
      });

      expect(results).toHaveLength(1);
      expect(stripAnsi(results[0].message)).toBe("The rule has been passed; actual 2, expected 3");
    });

    it("should report both passed and failed rules of the same config", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0, minTestsCount: 1 }],
      });

      const { results, fastFailed } = await qualityGate.validate({
        trs: [createTestResult("1", "failed")],
      });

      expect(results).toHaveLength(2);
      expect(results.map(({ rule, success }) => ({ rule, success }))).toEqual([
        { rule: "maxFailures", success: false },
        { rule: "minTestsCount", success: true },
      ]);
      expect(fastFailed).toBe(false);
    });

    it("shouldn't fast fail because of a passed rule", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "failed",
        validate: async () => ({
          success: true,
          actual: 0,
          testResults: [],
        }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 0, fastFail: true }, { minTestsCount: 1 }],
        use: [mockRule, minTestsCountRule],
      });

      const { results, fastFailed } = await qualityGate.validate({
        trs: [createTestResult("1", "passed")],
      });

      expect(fastFailed).toBe(false);
      expect(results.map(({ rule }) => rule)).toEqual(["mockRule", "minTestsCount"]);
    });

    it("shouldn't call subsequent rulesets when a rule with fastFail: true fails", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule 1 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
        }),
      };
      const mockRule2: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule 1 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ id: "customId", mockRule1: 3 }],
        use: [mockRule1, mockRule2],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("customId/mockRule1");
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
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("maxFailures");
      expect(fastFailed).toBe(false);
    });

    it("should ignore retries for default rules", async () => {
      const config: QualityGateConfig = {
        rules: [{ maxFailures: 0 }],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed", undefined, true),
      ];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toEqual([expect.objectContaining({ rule: "maxFailures", success: true, actual: 0 })]);
      expect(fastFailed).toBe(false);
    });

    it("should keep accumulators stable when the same gate validates the same batch twice", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0 }],
      });
      const state = new QualityGateState();
      const testResults: TestResult[] = [createTestResult("1", "failed")];

      const first = await qualityGate.validate({ state, trs: testResults });
      const second = await qualityGate.validate({ state, trs: testResults });

      expect(first.results[0].actual).toBe(1);
      expect(first.results[0].testResults).toEqual(["1"]);
      expect(second.results[0].actual).toBe(1);
      expect(second.results[0].testResults).toEqual(["1"]);
    });

    it("should consume only new ids from overlapping batches with the same gate", async () => {
      const qualityGate = new QualityGate({
        rules: [{ minTestsCount: 3 }],
      });
      const state = new QualityGateState();

      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "passed"), createTestResult("2", "passed")],
      });
      const { results } = await qualityGate.validate({
        state,
        trs: [createTestResult("2", "passed"), createTestResult("3", "passed")],
      });

      expect(results).toEqual([expect.objectContaining({ rule: "minTestsCount", success: true })]);
      expect(state.getResult("minTestsCount")).toBe(3);
    });

    it("should not consume retry id before non-retry with same id arrives", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0 }],
      });
      const state = new QualityGateState();

      await qualityGate.validate({ state, trs: [createTestResult("1", "failed", undefined, true)] });
      const { results } = await qualityGate.validate({
        state,
        trs: [createTestResult("1", "failed")],
      });

      expect(results).toHaveLength(1);
      expect(results[0].actual).toBe(1);
      expect(results[0].testResults).toEqual(["1"]);
    });

    it("should accumulate evidence ids across multiple validate calls", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0 }],
      });
      const state = new QualityGateState();

      await qualityGate.validate({ state, trs: [createTestResult("1", "failed")] });
      const { results } = await qualityGate.validate({
        state,
        trs: [createTestResult("2", "broken")],
      });

      expect(results[0].actual).toBe(2);
      expect(results[0].testResults).toEqual(["1", "2"]);
    });

    it("should include accumulated evidence when fast fail stops validation", async () => {
      const qualityGate = new QualityGate({
        rules: [{ maxFailures: 0, fastFail: true }, { minTestsCount: 10 }],
      });
      const state = new QualityGateState();

      await qualityGate.validate({ state, trs: [createTestResult("1", "failed")] });
      const { results, fastFailed } = await qualityGate.validate({
        state,
        trs: [createTestResult("2", "failed")],
      });

      expect(fastFailed).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].testResults).toEqual(["1", "2"]);
    });

    it("should reset dedupe for a new gate instance", async () => {
      const config: QualityGateConfig = {
        rules: [{ maxFailures: 0 }],
      };
      const testResults: TestResult[] = [createTestResult("1", "failed")];

      await new QualityGate(config).validate({ trs: testResults });
      const { results } = await new QualityGate(config).validate({ trs: testResults });

      expect(results[0].actual).toBe(1);
      expect(results[0].testResults).toEqual(["1"]);
    });

    it("should keep seen-id dedupe in shared state across gate instances", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      };
      const state = new QualityGateState();
      const testResults: TestResult[] = [createTestResult("1", "passed")];

      await new QualityGate(config).validate({ state, trs: testResults });
      await new QualityGate(config).validate({ state, trs: testResults });

      expect(mockRule.validate).toHaveBeenNthCalledWith(1, expect.objectContaining({ trs: testResults }));
      expect(mockRule.validate).toHaveBeenNthCalledWith(2, expect.objectContaining({ trs: [] }));
    });

    it("should pass unseen batch test results to custom rules", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      });
      const state = new QualityGateState();

      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "passed"), createTestResult("2", "passed")],
      });
      await qualityGate.validate({
        state,
        trs: [createTestResult("2", "passed"), createTestResult("3", "passed")],
      });

      expect(mockRule.validate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          trs: [expect.objectContaining({ id: "3" })],
        }),
      );
    });

    it("should omit accepted and muted results from every quality gate rule", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      });

      await qualityGate.validate({
        trs: [
          { ...createTestResult("accepted", "failed"), resolution: "accepted" },
          { ...createTestResult("muted", "broken"), resolution: "muted" },
          { ...createTestResult("issue", "failed"), resolution: "issue" },
          createTestResult("unresolved", "broken"),
        ],
      });

      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [expect.objectContaining({ id: "issue" }), expect.objectContaining({ id: "unresolved" })],
        }),
      );
    });

    it("should pass same deduped batch to all rules in the same ruleset", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const mockRule2: QualityGateRule<number> = {
        rule: "mockRule2",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule1: 0, mockRule2: 0 }],
        use: [mockRule1, mockRule2],
      });
      const state = new QualityGateState();

      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "passed"), createTestResult("1", "failed"), createTestResult("2", "passed")],
      });

      const expectedTrs = [expect.objectContaining({ id: "1" }), expect.objectContaining({ id: "2" })];

      expect(mockRule1.validate).toHaveBeenCalledWith(expect.objectContaining({ trs: expectedTrs }));
      expect(mockRule2.validate).toHaveBeenCalledWith(expect.objectContaining({ trs: expectedTrs }));
    });

    it("should keep same-call ids available across rulesets and dedupe later calls with the same gate", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const qualityGate = new QualityGate({
        rules: [
          { id: "one", mockRule: 0 },
          { id: "two", mockRule: 0 },
        ],
        use: [mockRule],
      });
      const state = new QualityGateState();

      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "passed")],
      });
      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "passed")],
      });

      expect(mockRule.validate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ trs: [expect.objectContaining({ id: "1" })] }),
      );
      expect(mockRule.validate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ trs: [expect.objectContaining({ id: "1" })] }),
      );
      expect(mockRule.validate).toHaveBeenNthCalledWith(3, expect.objectContaining({ trs: [] }));
      expect(mockRule.validate).toHaveBeenNthCalledWith(4, expect.objectContaining({ trs: [] }));
    });

    it("should run ruleset filter before global dedupe", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn().mockResolvedValue({ success: true, actual: 0, testResults: [] }),
      };
      const qualityGate = new QualityGate({
        rules: [
          { id: "filtered", mockRule: 0, filter: (tr) => tr.status === "passed" },
          { id: "all", mockRule: 0 },
        ],
        use: [mockRule],
      });
      const state = new QualityGateState();

      await qualityGate.validate({
        state,
        trs: [createTestResult("1", "failed"), createTestResult("2", "passed")],
      });

      expect(mockRule.validate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ trs: [expect.objectContaining({ id: "2" })] }),
      );
      expect(mockRule.validate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ trs: [expect.objectContaining({ id: "1" }), expect.objectContaining({ id: "2" })] }),
      );
    });

    it("should accumulate newly affected test results through atomic rule state", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => "Done",
        validate: vi.fn(async ({ state, trs }) => {
          const actual = (state.getResult() ?? 0) + trs.length;
          const testResults = trs.map(({ id }) => id);

          state.setResult(actual, testResults);

          return { success: false, actual, testResults };
        }),
      };
      const qualityGate = new QualityGate({
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      });
      const state = new QualityGateState();

      await qualityGate.validate({ state, trs: [createTestResult("1", "failed")] });
      const { results } = await qualityGate.validate({
        state,
        trs: [createTestResult("2", "failed")],
      });

      expect(results[0].actual).toBe(2);
      expect(results[0].testResults).toEqual(["1", "2"]);
    });

    it("should fast fail when any rules set has fastFail flag", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule1: 3, fastFail: true }, { mockRule2: 5 }],
        use: [mockRule1],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];
      const { results, fastFailed } = await qualityGate.validate({
        trs: testResults,
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].rule).toBe("mockRule1");
      expect(fastFailed).toBe(true);
    });

    it("shouldn't call subsequent rules in the same ruleset when a rule with fastFail: true fails", async () => {
      const mockRule1: QualityGateRule<number> = {
        rule: "mockRule1",
        message: ({ actual, expected }) => `Mock rule 1 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 5,
          expected: 3,
          testResults: [],
        }),
      };
      const mockRule2: QualityGateRule<number> = {
        rule: "mockRule2",
        message: ({ actual, expected }) => `Mock rule 2 failed with ${actual} vs ${expected}`,
        validate: async () => ({
          success: false,
          actual: 10,
          expected: 5,
          testResults: [],
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
      });

      expect(validateSpy1).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("mockRule1");
      expect(fastFailed).toBe(true);
      expect(validateSpy2).not.toHaveBeenCalled();
    });

    it("should use external state between validations", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
        validate: async ({ state }) => {
          const actual = (state.getResult() ?? 0) + 1;

          state.setResult(actual);

          return {
            success: true,
            expected: 3,
            actual,
            testResults: [],
          };
        },
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const qgState = new QualityGateState();

      await qualityGate.validate({
        state: qgState,
        trs: testResults,
      });

      const { fastFailed } = await qualityGate.validate({
        state: qgState,
        trs: testResults,
      });

      // rule had been called twice, so the rule state incremented twice
      expect(qgState.getResult("mockRule")).toBe(2);
      expect(fastFailed).toBe(false);
    });

    it("should work without external state", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRuleNoState",
        message: () => "ok",
        validate: async () => ({
          success: true,
          actual: 0,
          expected: 0,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRuleNoState: 0 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed")];
      const result = await qualityGate.validate({
        trs: testResults,
      });

      expect(result.results).toEqual([expect.objectContaining({ rule: "mockRuleNoState", success: true })]);
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
          testResults: [],
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
      });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe("maxFailures");
      expect(fastFailed).toBe(false);
    });

    it("should not filter test results when filter function is not provided", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => `Done`,
        validate: vi.fn().mockResolvedValue({
          success: true,
          actual: 1,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];

      await qualityGate.validate({
        trs: testResults,
      });

      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: testResults,
        }),
      );
    });

    it("should pass only non-retry test results to custom rules", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => `Done`,
        validate: vi.fn().mockResolvedValue({
          success: true,
          actual: 1,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [
        createTestResult("1", "passed"),
        createTestResult("2", "failed", undefined, true),
      ];

      await qualityGate.validate({
        trs: testResults,
      });

      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: testResults.slice(0, 1),
        }),
      );
    });

    it("should dedupe duplicate ids within a single call without shared state", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => `Done`,
        validate: vi.fn().mockResolvedValue({
          success: true,
          actual: 1,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 0 }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);

      await qualityGate.validate({
        trs: [createTestResult("1", "passed"), createTestResult("1", "failed")],
      });

      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [expect.objectContaining({ id: "1", status: "failed" })],
        }),
      );
    });

    it("should filter test results when filter function is provided", async () => {
      const mockRule: QualityGateRule<number> = {
        rule: "mockRule",
        message: () => `Done`,
        validate: vi.fn().mockResolvedValue({
          success: true,
          actual: 1,
          testResults: [],
        }),
      };
      const config: QualityGateConfig = {
        rules: [{ mockRule: 0, filter: (tr) => tr.status === "passed" }],
        use: [mockRule],
      };
      const qualityGate = new QualityGate(config);
      const testResults: TestResult[] = [createTestResult("1", "passed"), createTestResult("2", "failed")];

      await qualityGate.validate({
        trs: testResults,
      });

      expect(mockRule.validate).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: testResults.slice(0, 1),
        }),
      );
    });
  });
});
