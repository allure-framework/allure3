import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FlakyDetectionConfig, HistoryDataPoint, TestStatus } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";

let directory: string;
let report: AllureReport | undefined;
const testId = "retry-failure-rate-test";
const retryHash = `${md5(testId)}.${md5("")}`;

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness-and-transitions");
  await story("retry failure-rate report flags");
  await label("coverage", "flakiness-and-transitions");
  directory = await mkdtemp(join(tmpdir(), "allure-retry-failure-rate-"));
  report = undefined;
});
afterEach(async () => {
  try {
    await report?.done();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const createReport = async (options: FlakyDetectionConfig, previous: TestStatus[][] = []) => {
  const historyPath = join(directory, "history.jsonl");
  const history: HistoryDataPoint[] = previous.map((attempts, index) => ({
    uuid: `previous-launch-${index}`,
    name: "previous launch",
    timestamp: index + 1,
    knownTestCaseIds: [],
    metrics: {},
    url: "",
    testResults: {
      [retryHash]: {
        id: `previous-result-${index}`,
        name: "test",
        status: attempts.at(-1)!,
        retries: attempts.slice(0, -1),
        url: "",
        retryHash,
      },
    },
  }));
  await writeFile(historyPath, history.map((point) => JSON.stringify(point)).join("\n"));
  const config = await resolveConfig(
    {
      output: join(directory, "report"),
      historyPath,
      appendHistory: false,
      flakyDetection: { algorithm: "retry-failure-rate", ...options },
    },
    { plugins: {} },
  );
  report = new AllureReport(config);
  await report.start();
  return report;
};

const getFinalResults = async (instance: AllureReport) => {
  // Report generation refreshes flags after all retries have been ingested.
  await instance.done();
  report = undefined;
  return instance.store.allTestResults();
};

describe("retry failure-rate report flags", () => {
  it.each(["status-changes", "retry-failure-rate"] as const)(
    "uses all comparable history by default for %s",
    async (algorithm) => {
      const history: TestStatus[][] = [
        ["broken", "failed"],
        ...Array.from({ length: 4 }, (): TestStatus[] => ["passed"]),
        ...Array.from({ length: 3 }, (): TestStatus[] => ["failed"]),
        ...Array.from({ length: 3 }, (): TestStatus[] => ["passed"]),
      ];
      const instance = await createReport({ algorithm, includePassedTests: true }, history);

      await instance.store.visitTestResult(
        { uuid: "current", testId, name: "test", status: "passed" },
        { readerId: "test" },
      );
      const [result] = await getFinalResults(instance);

      expect(result.flaky).toBe(true);
    },
  );

  it("infers uniform failing retries alongside historical passes", async () => {
    const instance = await createReport({}, [["passed"], ["passed"], ["passed"]]);
    await instance.store.visitTestResult(
      { uuid: "first", testId, name: "test", status: "failed", start: 1 },
      { readerId: "test" },
    );

    await instance.store.visitTestResult(
      { uuid: "last", testId, name: "test", status: "failed", start: 2 },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(true);
  });

  it.each([
    { name: "uniform failures", attempts: ["failed", "failed"], expected: false },
    { name: "uniform broken outcomes", attempts: ["broken", "broken"], expected: false },
    { name: "uniform passes", attempts: ["passed", "passed"], expected: false },
    { name: "retry recoveries", attempts: ["failed", "passed"], expected: true },
    { name: "mixed failures", attempts: ["failed", "broken"], expected: true },
  ] as { name: string; attempts: TestStatus[]; expected: boolean }[])(
    "classifies five identical $name executions",
    async ({ attempts, expected }) => {
      const instance = await createReport({ includePassedTests: true }, [
        ["failed", "broken"],
        ...Array.from({ length: 4 }, () => [...attempts]),
      ]);

      for (const [index, status] of attempts.entries()) {
        await instance.store.visitTestResult(
          { uuid: `attempt-${index}`, testId, name: "test", status, start: index + 1 },
          { readerId: "test" },
        );
      }
      const [result] = await getFinalResults(instance);

      expect(result.flaky).toBe(expected);
    },
  );

  it.each([
    {
      name: "infers passed recovery when explicitly enabled",
      status: "passed",
      includePassedTests: true,
      expected: true,
    },
    {
      name: "does not infer passed recovery by default",
      status: "passed",
      includePassedTests: undefined,
      expected: false,
    },
    { name: "does not infer skipped recovery", status: "skipped", includePassedTests: true, expected: false },
    { name: "does not infer unknown recovery", status: "unknown", includePassedTests: true, expected: false },
  ] as const)("$name", async ({ status, includePassedTests, expected }) => {
    const instance = await createReport({ includePassedTests });
    await instance.store.visitTestResult(
      { uuid: "first-attempt", testId, name: "test", status: "failed", start: 1 },
      { readerId: "test" },
    );

    await instance.store.visitTestResult(
      { uuid: "final-attempt", testId, name: "test", status, start: 2 },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(expected);
  });

  it("infers a current execution with mixed failure statuses", async () => {
    const instance = await createReport({});
    await instance.store.visitTestResult(
      { uuid: "mixed-first", testId, name: "test", status: "failed", start: 1 },
      { readerId: "test" },
    );

    await instance.store.visitTestResult(
      { uuid: "mixed-final", testId, name: "test", status: "broken", start: 2 },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(true);
  });

  it.each(["failed", "broken"] as const)("infers current %s from recorded historical recovery", async (status) => {
    const instance = await createReport({}, [["failed", "passed"]]);

    await instance.store.visitTestResult({ uuid: "current", testId, name: "test", status }, { readerId: "test" });
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(true);
  });

  it("infers a current failure from recorded mixed failure statuses", async () => {
    const instance = await createReport({}, [["failed", "broken"]]);

    await instance.store.visitTestResult(
      { uuid: "current", testId, name: "test", status: "failed" },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(true);
  });

  it.each([
    { options: { includePassedTests: true, retryFailureThreshold: 0.5 }, expected: false },
    { options: { includePassedTests: true, historyDepth: -1 }, expected: false },
  ])("applies classifier cutoff/disable settings $options", async ({ options, expected }) => {
    const instance = await createReport(options);
    await instance.store.visitTestResult(
      { uuid: "first", testId, name: "test", status: "failed", start: 1 },
      { readerId: "test" },
    );

    await instance.store.visitTestResult(
      { uuid: "last", testId, name: "test", status: "passed", start: 2 },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(expected);
  });

  it("preserves SDK-reported flakiness independently of inference", async () => {
    const instance = await createReport({ historyDepth: -1, retryFailureThreshold: 1 });

    await instance.store.visitTestResult(
      { uuid: "current", testId, name: "test", status: "passed", flaky: true },
      { readerId: "test" },
    );
    const [result] = await getFinalResults(instance);

    expect(result.flaky).toBe(true);
  });
});
