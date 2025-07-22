import type { KnownTestFailure, TestCase, TestResult } from "@allurereport/core-api";
import type { AllureStore, QualityGateConfig } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import {
  maxFailuresRule,
  minTestsCountRule,
  runQualityGate,
  stringifyQualityGateResults,
  successRateRule,
} from "../src/qualityGate.js";

const fixtures = {
  trs: {
    passed: {
      name: "passed test result",
      status: "passed",
      labels: [],
    },
    failed: {
      name: "failed test result",
      status: "failed",
      labels: [],
    },
    broken: {
      name: "broken test result",
      status: "broken",
      labels: [],
    },
  } as Record<string, Partial<TestResult>>,
  trsMeta: {
    feature: {
      labels: [{ name: "feature", value: "example" }],
    },
  },
  known: [
    {
      historyId: "foobarbaz",
    },
  ] as KnownTestFailure[],
};

describe("maxFailuresRule", () => {
  it("should fail when there are more failures than allowed", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.failed, fixtures.trs.passed],
      allKnownIssues: async () => [] as KnownTestFailure[],
    } as AllureStore;
    const result = await maxFailuresRule.validate(0, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: false,
      expected: 0,
      actual: 1,
    });
  });

  it("should pass when there are less failures than allowed", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.passed],
      allKnownIssues: async () => [] as KnownTestFailure[],
    } as AllureStore;
    const result = await maxFailuresRule.validate(0, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: true,
      expected: 0,
      actual: 0,
    });
  });

  it("should exclude known issues from the failed tests pool", async () => {
    const store = {
      allTestResults: async () => [
        fixtures.trs.passed,
        {
          ...fixtures.trs.failed,
          historyId: fixtures.known[0].historyId,
        },
      ],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await maxFailuresRule.validate(0, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: true,
      expected: 0,
      actual: 0,
    });
  });
});

describe("minTestsCountRule", () => {
  it("should fail when there are less tests than expected", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.failed, fixtures.trs.passed],
    } as AllureStore;
    const result = await minTestsCountRule.validate(3, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: false,
      expected: 3,
      actual: 2,
    });
  });

  it("should pass when there are more tests than expected", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.passed],
    } as AllureStore;
    const result = await minTestsCountRule.validate(2, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: true,
      expected: 2,
      actual: 2,
    });
  });
});

describe("successRateRule", () => {
  it("should fail when success rate is less than the limit", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.passed],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await successRateRule.validate(1, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: false,
      expected: 1,
      actual: 0.25,
    });
  });

  it("should pass when success rate is more than the limit", async () => {
    const store = {
      allTestResults: async () => [fixtures.trs.failed, fixtures.trs.passed, fixtures.trs.passed, fixtures.trs.passed],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await successRateRule.validate(0.5, store, {
      trFilter: () => true,
    });

    expect(result).toEqual({
      success: true,
      expected: 0.5,
      actual: 0.75,
    });
  });
});

describe("qualityGate", () => {
  it("should validate test results with a given rules", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          minTestsCount: 5,
          maxFailures: 5,
          successRate: 0.5,
        },
      ],
    };
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actual: 4,
          expected: 5,
          success: false,
          rule: "minTestsCount",
        }),
        expect.objectContaining({
          actual: 0.25,
          expected: 0.5,
          success: false,
          rule: "successRate",
        }),
      ]),
    );
  });

  it("should include successful checks only when requested", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          minTestsCount: 5,
          maxFailures: 5,
          successRate: 0.5,
        },
      ],
    };
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config, {
      includeAll: true,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actual: 4,
          expected: 5,
          success: false,
          rule: "minTestsCount",
        }),
        expect.objectContaining({
          actual: 3,
          expected: 5,
          success: true,
          rule: "maxFailures",
        }),
        expect.objectContaining({
          actual: 0.25,
          expected: 0.5,
          success: false,
          rule: "successRate",
        }),
      ]),
    );
  });

  it("should validate test results with a given rules with custom filter", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          minTestsCount: 5,
          maxFailures: 5,
          successRate: 0.5,
          filter: (tr: TestResult) => !!tr.labels.find(({ name, value }) => name === "feature" && value === "example"),
        },
      ],
    };
    const store = {
      allTestResults: async () => [
        fixtures.trs.passed,
        fixtures.trs.passed,
        fixtures.trs.passed,
        fixtures.trs.failed,
        fixtures.trs.failed,
        fixtures.trs.failed,
        {
          ...fixtures.trs.passed,
          ...fixtures.trsMeta.feature,
        },
        {
          ...fixtures.trs.failed,
          ...fixtures.trsMeta.feature,
        },
        {
          ...fixtures.trs.failed,
          ...fixtures.trsMeta.feature,
        },
        {
          ...fixtures.trs.failed,
          ...fixtures.trsMeta.feature,
        },
      ],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actual: 4,
          expected: 5,
          success: false,
        }),
        expect.objectContaining({
          actual: 0.25,
          expected: 0.5,
          success: false,
        }),
      ]),
    );
  });

  it("should allow rule message re-assignment", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          minTestsCount: 5,
          maxFailures: 5,
          successRate: 0.5,
        },
      ],
      use: [
        minTestsCountRule,
        maxFailuresRule,
        {
          ...successRateRule,
          message: ({ actual, expected }) => `Custom message: ${expected} > ${actual}`,
        },
      ],
    };
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config, {
      includeAll: true,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actual: 4,
          expected: 5,
          success: false,
          rule: "minTestsCount",
        }),
        expect.objectContaining({
          actual: 3,
          expected: 5,
          success: true,
          rule: "maxFailures",
        }),
        expect.objectContaining({
          actual: 0.25,
          expected: 0.5,
          success: false,
          rule: "successRate",
          message: "Custom message: 0.5 > 0.25",
        }),
      ]),
    );
  });

  it("should allow rule reassignment", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          successRate: 0.5,
        },
      ],
      use: [
        {
          ...successRateRule,
          message: ({ actual, expected }) => `First custom message: ${expected} > ${actual}`,
        },
        {
          ...successRateRule,
          message: ({ actual, expected }) => `Second custom message: ${expected} > ${actual}`,
        },
      ],
    };
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config, {
      includeAll: true,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actual: 0.25,
          expected: 0.5,
          success: false,
          rule: "successRate",
          message: "Second custom message: 0.5 > 0.25",
        }),
      ]),
    );
  });
});

describe("stringifyQualityGateResults", () => {
  it("should return a string representation of the quality gate results", async () => {
    const config: QualityGateConfig = {
      rules: [
        {
          minTestsCount: 5,
        },
        {
          id: "first",
          maxFailures: 5,
        },
        {
          id: "second",
          successRate: 0.5,
        },
      ],
    };
    const store = {
      allTestResults: async () => [fixtures.trs.passed, fixtures.trs.failed, fixtures.trs.failed, fixtures.trs.failed],
      allTestCases: async () => [] as TestCase[],
      allKnownIssues: async () => fixtures.known,
    } as AllureStore;
    const result = await runQualityGate(store, config, {
      includeAll: true,
    });

    expect(stringifyQualityGateResults(result)).toMatchSnapshot();
  });
});
