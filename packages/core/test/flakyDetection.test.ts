import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { HistoryDataPoint, TestResult } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import type { RawTestResult } from "@allurereport/reader-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";

const mocks = vi.hoisted(() => ({ getTestFlakiness: vi.fn() }));
vi.mock("@allurereport/core-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/core-api")>()),
  getTestFlakiness: mocks.getTestFlakiness,
}));

const testId = "flaky-test";
const historyId = `${md5(testId)}.${md5("")}`;
const readerId = "flakyDetection.test.ts";
const rawResult: RawTestResult = { uuid: "current-result", testId, name: "example test", status: "failed" };
let directory: string;
let reports: AllureReport[];

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness-and-transitions");
  await story("flaky detection contract");
  await label("coverage", "flakiness-and-transitions");
  mocks.getTestFlakiness.mockReset();
  directory = await mkdtemp(join(tmpdir(), "allure-flaky-detection-"));
  reports = [];
});
afterEach(async () => {
  try {
    for (const report of reports) {
      await report.done();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const createReport = async () => {
  const historyPath = join(directory, "history.jsonl");
  const point: HistoryDataPoint = {
    uuid: "launch",
    name: "previous launch",
    timestamp: 1,
    knownTestCaseIds: [],
    metrics: {},
    url: "",
    testResults: { [historyId]: { id: "historical-result", name: "example test", status: "passed", url: "" } },
  };
  await writeFile(historyPath, JSON.stringify(point));
  const config = await resolveConfig(
    { output: join(directory, "report"), historyPath, appendHistory: false },
    { plugins: {} },
  );
  const report = new AllureReport(config);
  await report.start();
  reports.push(report);
  return report;
};

const expectFlakinessInputs = (result: TestResult, retries: TestResult[] = []) => {
  expect(mocks.getTestFlakiness).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      id: result.id,
      name: rawResult.name,
      status: rawResult.status,
      retryHash: result.retryHash,
      retries,
    }),
    [expect.objectContaining({ id: "historical-result", name: "example test", status: "passed", url: "" })],
    { historyDepth: undefined, stabilizationPeriod: undefined },
  );
};

const outcomes = [
  { description: "marks unstable failed tests as flaky", value: true, expected: true },
  { description: "keeps stable failed tests unmarked", value: false, expected: false },
  { description: "keeps failed tests without comparable history unmarked", value: undefined, expected: false },
];
describe("flaky tests", () => {
  it.each(outcomes)("$description during ingestion", async ({ value, expected }) => {
    const report = await createReport();
    mocks.getTestFlakiness.mockReturnValue(value);

    await report.store.visitTestResult(rawResult, { readerId });
    const [result] = await report.store.allTestResults();

    expectFlakinessInputs(result);
    expect(result.flaky).toBe(expected);
  });
  it.each(outcomes)("$description during history refresh", async ({ value, expected }) => {
    const report = await createReport();
    mocks.getTestFlakiness.mockReturnValue(!expected);
    await report.store.visitTestResult(rawResult, { readerId });
    mocks.getTestFlakiness.mockClear();
    mocks.getTestFlakiness.mockReturnValue(value);

    report.store.updateHistoryFlags();
    const [result] = await report.store.allTestResults();

    expectFlakinessInputs(result);
    expect(result.flaky).toBe(expected);
  });
  it.each(outcomes)("$description during history refresh with retries", async ({ value, expected }) => {
    const report = await createReport();
    mocks.getTestFlakiness.mockReturnValue(!expected);
    await report.store.visitTestResult({ ...rawResult, uuid: "first-retry", status: "broken", start: 1 }, { readerId });
    await report.store.visitTestResult({ ...rawResult, uuid: "second-retry", start: 2 }, { readerId });
    const [firstRetry, secondRetry] = await report.store.allTestResults({ includeRetries: true });
    await report.store.visitTestResult(
      { uuid: "unrelated-result", testId: "other-test", name: "other test", status: "passed", start: 3 },
      { readerId },
    );
    await report.store.visitTestResult({ ...rawResult, start: 4 }, { readerId });
    const result = (await report.store.allTestResults()).find((testResult) => testResult.name === rawResult.name)!;
    mocks.getTestFlakiness.mockClear();
    mocks.getTestFlakiness.mockReturnValue(value);

    report.store.updateHistoryFlags([result]);

    expectFlakinessInputs(result, [secondRetry, firstRetry]);
    expect(result.flaky).toBe(expected);
  });
});
