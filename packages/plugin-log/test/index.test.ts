/* eslint-disable no-console */
import type { TestResult } from "@allurereport/core-api";
import type { MockedFunction } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { printTest } from "../src/utils.js";

const glueConsoleCalls = (calls: any[]) => calls.flatMap((args: any[]) => args[0]).join("\n");

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

    const result = glueConsoleCalls((console.info as MockedFunction<any>).mock.calls);

    expect(result).toMatchSnapshot();
  });
});
