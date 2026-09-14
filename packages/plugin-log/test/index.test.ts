/* eslint-disable no-console */
import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, QualityGateValidationResult } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LogPlugin } from "../src/plugin.js";
import { printQualityGateResults, printSummary, printTest } from "../src/utils.js";

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
  ] as QualityGateValidationResult[],
};

vi.mock("../src/utils.js", async () => {
  return {
    ...(await vi.importActual("../src/utils.js")),
    printTest: vi.fn(),
    printSummary: vi.fn(),
    printQualityGateResults: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const createStore = (
  testResults = fixtures.testResults,
  qualityGateResults = fixtures.qualityGateResults,
): AllureStore =>
  ({
    allTestResults: vi.fn().mockResolvedValue(testResults),
    testResultsByLabel: vi.fn().mockResolvedValue({
      _: [...testResults],
    }),
    qualityGateResults: vi.fn().mockResolvedValue(qualityGateResults),
  }) as unknown as AllureStore;

const expectQualityGateResultsAfterSummary = () => {
  const summaryCallOrder = vi.mocked(printSummary).mock.invocationCallOrder[0];
  const qualityGateCallOrder = vi.mocked(printQualityGateResults).mock.invocationCallOrder[0];

  expect(summaryCallOrder).toBeLessThan(qualityGateCallOrder);
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
    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults);
    expectQualityGateResultsAfterSummary();
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
    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults);
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
    expect(printQualityGateResults).toHaveBeenCalledWith(fixtures.qualityGateResults);
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
  });
});
