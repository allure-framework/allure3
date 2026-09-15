import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AllureReport, resolveConfig } from "@allurereport/core";
import type { Statistic, TestResult } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { collectReportSummary } from "../../../src/commands/commons/summary.js";

const md5 = (value: string): string => createHash("md5").update(value).digest("hex");

const testResult = (id: string, duration?: number): TestResult =>
  ({
    id,
    name: id,
    fullName: id,
    duration,
  }) as TestResult;

const writeAllureResult = async (
  resultsDir: string,
  result: { uuid: string; testCaseId: string; status: "passed" | "failed"; start: number; duration: number },
) => {
  await writeFile(
    join(resultsDir, `${result.uuid}-result.json`),
    `${JSON.stringify(
      {
        uuid: result.uuid,
        name: `${result.testCaseId} test`,
        fullName: `native.${result.testCaseId}`,
        testCaseId: result.testCaseId,
        status: result.status,
        start: result.start,
        stop: result.start + result.duration,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
};

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("collectReportSummary", () => {
  it("collects a generic summary from native current results and statistics", async () => {
    const stats: Statistic = {
      total: 2,
      passed: 1,
      failed: 1,
      broken: 0,
      skipped: 0,
      unknown: 0,
      flaky: 1,
      retries: 1,
    };
    const store = {
      allTestResults: vi.fn().mockResolvedValue([testResult("a", 100), testResult("b", 250)]),
      allNewTestResults: vi.fn().mockResolvedValue([testResult("b"), testResult("retry-b")]),
      testsStatistic: vi.fn().mockResolvedValue(stats),
    } as unknown as AllureStore;

    await expect(collectReportSummary(store, "GitLab report")).resolves.toEqual({
      name: "GitLab report",
      duration: 350,
      stats,
      newTests: 1,
      flakyTests: 1,
      retryTests: 1,
    });

    expect(store.allTestResults).toHaveBeenCalledWith({ includeRetries: false });
    expect(store.allNewTestResults).toHaveBeenCalledWith();
    expect(store.testsStatistic).toHaveBeenCalledWith();
  });

  it("captures native empty-history retry runs before done appends history", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "allure-summary-native-"));
    tempDirs.push(tempDir);
    const resultsDir = join(tempDir, "allure-results");
    await mkdir(resultsDir, { recursive: true });
    await writeAllureResult(resultsDir, {
      uuid: "retry-b",
      testCaseId: "b",
      status: "failed",
      start: 100,
      duration: 10,
    });
    await writeAllureResult(resultsDir, { uuid: "b", testCaseId: "b", status: "passed", start: 200, duration: 30 });
    await writeAllureResult(resultsDir, { uuid: "a", testCaseId: "a", status: "failed", start: 300, duration: 40 });

    const config = await resolveConfig(
      {
        name: "Native Retry Report",
        output: join(tempDir, "report"),
        historyPath: join(tempDir, "history.jsonl"),
        historyBaseUrl: "https://example.test/allure-report/",
      },
      { plugins: {} },
    );
    const report = new AllureReport(config);

    await report.start();
    await report.readDirectory(resultsDir);

    const currentWithoutRetries = await report.store.allTestResults({ includeRetries: false });
    const currentIds = currentWithoutRetries.map(({ id }) => id).sort();
    const newIdsBeforeDone = (await report.store.allNewTestResults()).map(({ id }) => id).sort();
    const summary = await collectReportSummary(report.store, "Native Retry Report");

    expect(currentIds).toEqual([md5("a"), md5("b")]);
    expect(newIdsBeforeDone).toEqual([md5("a"), md5("retry-b"), md5("b")]);
    expect(summary).toEqual({
      name: "Native Retry Report",
      duration: 70,
      stats: {
        total: 2,
        passed: 1,
        failed: 1,
        new: 2,
        retries: 1,
      },
      newTests: 2,
      flakyTests: 0,
      retryTests: 1,
    });

    await report.done();

    expect(await report.store.allNewTestResults()).toEqual([]);
  });

  it("defaults optional flaky and retry statistic counters to zero", async () => {
    const stats: Statistic = { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 };
    const store = {
      allTestResults: vi.fn().mockResolvedValue([testResult("a")]),
      allNewTestResults: vi.fn().mockResolvedValue([testResult("a")]),
      testsStatistic: vi.fn().mockResolvedValue(stats),
    } as unknown as AllureStore;

    await expect(collectReportSummary(store, "Allure Report")).resolves.toMatchObject({
      duration: 0,
      newTests: 1,
      flakyTests: 0,
      retryTests: 0,
    });
  });
});
