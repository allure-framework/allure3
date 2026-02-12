/* eslint-disable no-console */
import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogPlugin } from "../src/plugin.js";
import { printSummary, printTest } from "../src/utils.js";

const fixtures = {
  testResults: [
    {
      name: "Test A",
      status: "passed",
    },
    {
      name: "Test B",
      status: "failed",
    },
  ] as TestResult[],
};

vi.mock("../src/utils.js", async () => {
  return {
    ...(await vi.importActual("../src/utils.js")),
    printTest: vi.fn(),
    printSummary: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("plugin", () => {
  it("prints all tests when filter is not provided", async () => {
    const store = {
      allTestResults: vi.fn().mockResolvedValue(fixtures.testResults),
      testResultsByLabel: vi.fn().mockResolvedValue({
        _: [...fixtures.testResults],
      }),
    } as unknown as AllureStore;
    const plugin = new LogPlugin({});

    await plugin.done({} as PluginContext, store);

    expect(printTest).toHaveBeenCalledTimes(fixtures.testResults.length);
    expect(printSummary).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledWith(fixtures.testResults, {
      total: fixtures.testResults.length,
      filtered: fixtures.testResults.length,
    });
  });

  it("prints all tests when filter is not provided and tests are not groupped", async () => {
    const store = {
      allTestResults: vi.fn().mockResolvedValue(fixtures.testResults),
      testResultsByLabel: vi.fn().mockResolvedValue({
        _: [...fixtures.testResults],
      }),
    } as unknown as AllureStore;
    const plugin = new LogPlugin({
      groupBy: "none",
    });

    await plugin.done({} as PluginContext, store);

    expect(printTest).toHaveBeenCalledTimes(fixtures.testResults.length);
    expect(printSummary).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledWith(fixtures.testResults, {
      total: fixtures.testResults.length,
      filtered: fixtures.testResults.length,
    });
  });

  it("prints only filtered tests when filter is provided", async () => {
    const store = {
      allTestResults: vi.fn().mockResolvedValue(fixtures.testResults),
      testResultsByLabel: vi.fn().mockResolvedValue({
        _: [...fixtures.testResults],
      }),
    } as unknown as AllureStore;
    const plugin = new LogPlugin({
      filter: (test) => test.status === "failed",
    });

    await plugin.done({} as PluginContext, store);

    expect(printTest).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledWith([fixtures.testResults[1]], {
      total: fixtures.testResults.length,
      filtered: 1,
    });
  });

  it("prints only filtered tests when filter is provided and tests are not groupped", async () => {
    const store = {
      allTestResults: vi.fn().mockResolvedValue(fixtures.testResults),
      testResultsByLabel: vi.fn().mockResolvedValue({
        _: [...fixtures.testResults],
      }),
    } as unknown as AllureStore;
    const plugin = new LogPlugin({
      groupBy: "none",
      filter: (test) => test.status === "failed",
    });

    await plugin.done({} as PluginContext, store);

    expect(printTest).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledWith([fixtures.testResults[1]], {
      total: fixtures.testResults.length,
      filtered: 1,
    });
  });
});
