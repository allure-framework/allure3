import console from "node:console";

import type { DefaultTestStepResult, TestResult } from "@allurereport/core-api";
import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

import {
  hasResultFailedSteps,
  isFailedResult,
  printQualityGateResults,
  printTest,
  stringifyQualityGateResultTitle,
  stringifyStatusBadge,
  stringifyStepResultTitle,
  stringifyTestResultTitle,
} from "../src/utils.js";

beforeEach(async () => {
  await story("utils");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const stripAnsi = (value: string) => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
const glueConsoleCalls = (calls: any[]) => stripAnsi(calls.flatMap((args: any[]) => args[0]).join("\n"));
const mockConsoleInfo = () => vi.spyOn(console, "info").mockImplementation(() => undefined);
const mockConsoleLog = () => vi.spyOn(console, "log").mockImplementation(() => undefined);

describe("utils", () => {
  describe("isFailedResult", () => {
    it("returns true for failed result", () => {
      expect(isFailedResult({ status: "failed" } as TestResult)).toBe(true);
    });

    it("returns true for broken result", () => {
      expect(isFailedResult({ status: "broken" } as TestResult)).toBe(true);
    });

    it("returns false for passed result", () => {
      expect(isFailedResult({ status: "passed" } as TestResult)).toBe(false);
    });
  });

  describe("hasTestFailedSteps", () => {
    it("returns true for test with failed steps", () => {
      const fixture = {
        steps: [
          {
            status: "passed",
            steps: [
              {
                status: "failed",
                type: "step",
              },
            ],
            type: "step",
          },
        ],
      } as TestResult;

      expect(hasResultFailedSteps(fixture)).toBe(true);
    });

    it("returns false for test without failed steps", () => {
      const fixture = {
        steps: [
          {
            status: "passed",
            steps: [
              {
                status: "passed",
                type: "step",
              },
            ],
            type: "step",
          },
        ],
      } as TestResult;

      expect(hasResultFailedSteps(fixture)).toBe(false);
    });
  });

  describe("stringifyStatusBadge", () => {
    it("returns green badge for passed status", () => {
      expect(stripAnsi(stringifyStatusBadge("passed"))).toBe("✓");
    });

    it("returns red badge for failed status", () => {
      expect(stripAnsi(stringifyStatusBadge("failed"))).toBe("⨯");
    });

    it("returns red badge for broken status", () => {
      expect(stripAnsi(stringifyStatusBadge("broken"))).toBe("⨯");
    });

    it("returns yellow badge for skipped status", () => {
      expect(stripAnsi(stringifyStatusBadge("skipped"))).toBe("-");
    });

    it("returns gray badge for unknown status", () => {
      expect(stripAnsi(stringifyStatusBadge("unknown"))).toBe("?");
    });
  });

  describe("stringifyTestResultTitle", () => {
    it("returns title with status, name and duration", () => {
      const fixture = {
        status: "passed",
        duration: 100,
        fullName: "path#test",
      } as TestResult;

      expect(stripAnsi(stringifyTestResultTitle(fixture))).toMatchSnapshot();
    });
  });

  describe("stringifyStepResultTitle", () => {
    it("returns title with status, name and duration", () => {
      const fixture = {
        status: "passed",
        duration: 100,
        name: "step",
      } as DefaultTestStepResult;

      expect(stripAnsi(stringifyStepResultTitle(fixture))).toMatchSnapshot();
    });
  });

  describe("stringifyQualityGateResultTitle", () => {
    it("returns title with status, rule and environment", () => {
      const fixture = {
        success: false,
        rule: "maxFailures",
        environment: "chrome",
      } as QualityGateValidationResult;

      expect(stripAnsi(stringifyQualityGateResultTitle(fixture))).toBe("⨯ maxFailures [chrome]");
    });
  });

  describe("printQualityGateResults", () => {
    it("prints quality gate results under their own section", () => {
      mockConsoleInfo();
      mockConsoleLog();

      const fixture = [
        {
          success: false,
          rule: "maxFailures",
          message: "The number of failed tests 1 exceeds the allowed threshold value 0",
          actual: 1,
          expected: 0,
          testResults: ["test-result-id"],
        },
      ] as QualityGateValidationResult[];

      printQualityGateResults(fixture);

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toContain("Quality gates");
      expect(result).toContain("maxFailures");
      expect(result).toContain("The number of failed tests 1 exceeds the allowed threshold value 0");
      expect(result).toContain("Quality gates: 1 failure");
    });
  });

  describe("printTest", () => {
    it("prints the test without steps if there are no failed steps", () => {
      mockConsoleInfo();

      const fixture = {
        name: "Test name",
        status: "passed",
        duration: 100,
        steps: [
          {
            name: "step 1",
            status: "passed",
            steps: [
              {
                name: "step 1.1",
                status: "passed",
              },
            ],
          },
        ],
      } as TestResult;

      printTest(fixture);

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toMatchSnapshot();
    });

    it("prints the test without passed steps", () => {
      mockConsoleInfo();

      const fixture = {
        name: "Test name",
        status: "passed",
        duration: 100,
        steps: [
          {
            name: "step 1",
            status: "passed",
            steps: [
              {
                name: "step 1.1",
                status: "passed",
              },
            ],
          },
          {
            name: "step 2",
            status: "failed",
          },
          {
            name: "step 3",
            status: "broken",
          },
        ],
      } as TestResult;

      printTest(fixture);

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toMatchSnapshot();
    });

    it("prints the test with all steps if allSteps is true", () => {
      mockConsoleInfo();

      const fixture = {
        name: "Test name",
        status: "passed",
        duration: 100,
        steps: [
          {
            name: "step 1",
            status: "passed",
            steps: [
              {
                name: "step 1.1",
                status: "passed",
              },
              {
                name: "step 1.2",
                status: "passed",
                steps: [
                  {
                    name: "step 1.2.1",
                    status: "passed",
                  },
                ],
              },
            ],
          },
        ],
      } as TestResult;

      printTest(fixture, { allSteps: true });

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toMatchSnapshot();
    });

    it("prints the test with all steps if `allSteps` is true", () => {
      mockConsoleInfo();

      const fixture = {
        name: "Test name",
        status: "failed",
        duration: 100,
        steps: [
          {
            name: "step 1",
            status: "failed",
            steps: [
              {
                name: "step 1.1",
                status: "failed",
              },
              {
                name: "step 1.2",
                status: "failed",
                steps: [
                  {
                    name: "step 1.2.1",
                    status: "failed",
                    error: {
                      message: "Error message",
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as TestResult;

      printTest(fixture);

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toMatchSnapshot();
    });

    it("prints error trace if `withTrace` is true", () => {
      mockConsoleInfo();

      const fixture = {
        name: "Test name",
        status: "failed",
        duration: 100,
        steps: [
          {
            name: "step 1",
            status: "failed",
            error: {
              message: "Error message",
              trace: "Error trace",
            },
          },
        ],
      } as TestResult;

      printTest(fixture, {
        withTrace: true,
      });

      // eslint-disable-next-line no-console
      const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

      expect(result).toMatchSnapshot();
    });
  });
});
