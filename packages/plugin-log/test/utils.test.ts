import type { DefaultTestStepResult, TestResult } from "@allurereport/core-api";
import { type MockedFunction, describe, expect, it, vi } from "vitest";
import {
  hasResultFailedSteps,
  isFailedResult,
  printTest,
  stringifyStatusBadge,
  stringifyStepResultTitle,
  stringifyTestResultTitle,
} from "../src/utils.js";

const glueConsoleCalls = (calls: any[]) => calls.flatMap((args: any[]) => args[0]).join("\n");

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
      expect(stringifyStatusBadge("passed")).toBe("\u001b[32m✓\u001b[39m");
    });

    it("returns red badge for failed status", () => {
      expect(stringifyStatusBadge("failed")).toBe("\u001b[31m⨯\u001b[39m");
    });

    it("returns red badge for broken status", () => {
      expect(stringifyStatusBadge("broken")).toBe("\u001b[31m⨯\u001b[39m");
    });

    it("returns yellow badge for skipped status", () => {
      expect(stringifyStatusBadge("skipped")).toBe("\u001b[90m-\u001b[39m");
    });

    it("returns gray badge for unknown status", () => {
      expect(stringifyStatusBadge("unknown")).toBe("\u001b[90m?\u001b[39m");
    });
  });

  describe("stringifyTestResultTitle", () => {
    it("returns title with status, name and duration", () => {
      const fixture = {
        status: "passed",
        duration: 100,
        fullName: "path#test",
      } as TestResult;

      expect(stringifyTestResultTitle(fixture)).toMatchSnapshot();
    });
  });

  describe("stringifyStepResultTitle", () => {
    it("returns title with status, name and duration", () => {
      const fixture = {
        status: "passed",
        duration: 100,
        name: "step",
      } as DefaultTestStepResult;

      expect(stringifyStepResultTitle(fixture)).toMatchSnapshot();
    });
  });

  describe("printTest", () => {
    it("prints the test without steps if there are no failed steps", () => {
      vi.spyOn(console, "info");

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
      vi.spyOn(console, "info");

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
      vi.spyOn(console, "info");

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
      vi.spyOn(console, "info");

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
      vi.spyOn(console, "info");

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
