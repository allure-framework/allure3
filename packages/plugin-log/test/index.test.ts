/* eslint-disable no-console */
import type { TestError, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, QualityGateValidationResult } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { LogPlugin } from "../src/plugin.js";
import { printGlobalErrors, printQualityGateResults, printSummary, printTest } from "../src/utils.js";

beforeEach(async () => {
  await story("index");
});
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
  qualityGateResults: [
    {
      success: false,
      rule: "maxFailures",
      message: "The number of failed tests 1 exceeds the allowed threshold value 0",
      actual: 1,
      expected: 0,
      testResults: ["test-result-id"],
    },
    {
      success: true,
      rule: "minTestsCount",
      message: "The number of tests 2 exceeds the minimum threshold value 1",
      actual: 2,
      expected: 1,
      testResults: ["test-result-id"],
    },
    {
      success: true,
      rule: "customRule",
      message: "Custom rule has passed",
      actual: 1,
      expected: 1,
      environment: "chrome",
      testResults: ["test-result-id"],
    },
  ] as QualityGateValidationResult[],
  globalErrors: [
    {
      message: "Global setup failed",
      trace: "Error: Global setup failed",
    },
  ] as TestError[],
};

const failedQualityGateResults = fixtures.qualityGateResults.filter(({ success }) => !success);

vi.mock("../src/utils.js", async () => {
  return {
    ...(await vi.importActual("../src/utils.js")),
    printTest: vi.fn(),
    printSummary: vi.fn(),
    printQualityGateResults: vi.fn(),
    printGlobalErrors: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const createStore = (
  testResults = fixtures.testResults,
  qualityGateResults = fixtures.qualityGateResults,
  globalErrors = fixtures.globalErrors,
): AllureStore =>
  ({
    allTestResults: vi.fn().mockResolvedValue(testResults),
    testResultsByLabel: vi.fn().mockResolvedValue({
      _: [...testResults],
    }),
    qualityGateResults: vi.fn().mockResolvedValue(qualityGateResults),
    allGlobalErrors: vi.fn().mockResolvedValue(globalErrors),
  }) as unknown as AllureStore;

const expectReportDetailsOrder = () => {
  const summaryCallOrder = vi.mocked(printSummary).mock.invocationCallOrder[0];
  const qualityGateCallOrder = vi.mocked(printQualityGateResults).mock.invocationCallOrder[0];
  const globalErrorsCallOrder = vi.mocked(printGlobalErrors).mock.invocationCallOrder[0];

  expect(summaryCallOrder).toBeLessThan(qualityGateCallOrder);
  expect(qualityGateCallOrder).toBeLessThan(globalErrorsCallOrder);
};

describe("plugin", () => {
  it("prints all tests when filter is not provided", async () => {
    const store = createStore();
    const plugin = new LogPlugin({});

    await plugin.done({} as PluginContext, store);

    expect(printTest).toHaveBeenCalledTimes(fixtures.testResults.length);
    expect(printSummary).toHaveBeenCalledTimes(1);
    expect(printSummary).toHaveBeenCalledWith(fixtures.testResults, {
      total: fixtures.testResults.length,
      filtered: fixtures.testResults.length,
    });
    expect(printQualityGateResults).toHaveBeenCalledWith(failedQualityGateResults);
    expect(printGlobalErrors).toHaveBeenCalledWith(fixtures.globalErrors, {});
    expectReportDetailsOrder();
  });

  it("prints all tests when filter is not provided and tests are not groupped", async () => {
    const store = createStore();
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
    expect(printQualityGateResults).toHaveBeenCalledWith(failedQualityGateResults);
  });

  it("prints only filtered tests when filter is provided", async () => {
    const store = createStore();
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
    expect(printQualityGateResults).toHaveBeenCalledWith(failedQualityGateResults);
  });

  it("prints only filtered tests when filter is provided and tests are not groupped", async () => {
    const store = createStore();
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
    expect(printQualityGateResults).toHaveBeenCalledWith(failedQualityGateResults);
  });

  it("prints all quality gate results when qualityGateFilter accepts every result", async () => {
    const store = createStore();
    const plugin = new LogPlugin({
      qualityGateFilter: () => true,
    });

    await plugin.done({} as PluginContext, store);

    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults);
  });

  it("prints only quality gate results selected by a custom status filter", async () => {
    const store = createStore();
    const plugin = new LogPlugin({
      qualityGateFilter: ({ success }) => success,
    });

    await plugin.done({} as PluginContext, store);

    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults.slice(1));
  });

  it("prints only quality gate results selected by rule and environment", async () => {
    const store = createStore();
    const plugin = new LogPlugin({
      qualityGateFilter: ({ environment, rule }) => environment === "chrome" && rule === "customRule",
    });

    await plugin.done({} as PluginContext, store);

    expect(printQualityGateResults).toHaveBeenCalledWith([fixtures.qualityGateResults[2]]);
  });

  it("doesn't apply test result filter to quality gate results", async () => {
    const store = createStore();
    const plugin = new LogPlugin({
      filter: (test) => test.status === "failed",
      qualityGateFilter: () => true,
    });

    await plugin.done({} as PluginContext, store);

    expect(printSummary).toHaveBeenCalledWith([fixtures.testResults[1]], {
      total: fixtures.testResults.length,
      filtered: 1,
    });
    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults);
  });

  it("doesn't read or print quality gate results when disabled", async () => {
    const store = createStore();
    const plugin = new LogPlugin({
      qualityGateResults: false,
    });

    await plugin.done({} as PluginContext, store);

    expect(store.qualityGateResults).not.toHaveBeenCalled();
    expect(printQualityGateResults).not.toHaveBeenCalled();
    expect(store.allGlobalErrors).toHaveBeenCalledTimes(1);
    expect(printGlobalErrors).toHaveBeenCalledWith(fixtures.globalErrors, {
      qualityGateResults: false,
    });
    expect(vi.mocked(printSummary).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(printGlobalErrors).mock.invocationCallOrder[0],
    );
  });

  it("passes an empty global error list to the silent printer", async () => {
    const store = createStore(fixtures.testResults, fixtures.qualityGateResults, []);
    const plugin = new LogPlugin({});

    await plugin.done({} as PluginContext, store);

    expect(printGlobalErrors).toHaveBeenCalledWith([], {});
  });
});
