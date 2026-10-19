import type { HistoryTestResult, TestResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFlakyDetector } from "../../src/utils/flaky.js";

const mocks = vi.hoisted(() => ({ getTestFlakiness: vi.fn() }));
vi.mock("@allurereport/core-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/core-api")>()),
  getTestFlakiness: mocks.getTestFlakiness,
}));
const current = (status: TestResult["status"]): TestResult => ({
  id: "current",
  name: "test",
  status,
  testCaseHash: "case",
  parametersHash: "parameters",
  environmentHash: null,
  retryHash: "retry",
  flaky: false,
  muted: false,
  known: false,
  isRetry: false,
  labels: [],
  parameters: [],
  links: [],
  steps: [],
  sourceMetadata: { readerId: "test", metadata: {} },
});
beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness-and-transitions");
  await story("badge eligibility");
  await label("coverage", "flakiness-and-transitions");
  mocks.getTestFlakiness.mockReset().mockReturnValue(true);
});
describe("createFlakyDetector", () => {
  it.each([
    ["failed", false, true],
    ["broken", false, true],
    ["passed", true, true],
    ["passed", false, false],
    ["skipped", true, false],
    ["unknown", true, false],
  ] as const)("applies eligibility for %s with includePassedTests=%s", (status, includePassedTests, expected) => {
    const result = current(status);
    const detector = createFlakyDetector({ includePassedTests });
    const history: (HistoryTestResult | undefined)[] = [undefined];

    const flaky = detector(result, history);

    expect(flaky).toBe(expected);
    expect(mocks.getTestFlakiness).toHaveBeenCalledTimes(expected ? 1 : 0);
  });
  it("excludes passed results by default", () => {
    const result = current("passed");
    const detector = createFlakyDetector();

    const flaky = detector(result, []);

    expect(flaky).toBe(false);
    expect(mocks.getTestFlakiness).not.toHaveBeenCalled();
  });
  it("marks unstable failed results as flaky with custom settings", () => {
    const result = current("failed");
    const history: (HistoryTestResult | undefined)[] = [undefined];
    const options = { historyDepth: 10, stabilizationPeriod: 5 };
    const detector = createFlakyDetector(options);

    const flaky = detector(result, history);

    expect(flaky).toBe(true);
    expect(mocks.getTestFlakiness).toHaveBeenCalledWith(result, history, options);
  });
});
