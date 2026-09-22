import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { type Config, md5 } from "@allurereport/plugin-api";
import type { RawTestResult } from "@allurereport/reader-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveConfig } from "../src/config.js";
import { AllureReport } from "../src/report.js";

const testId = "flaky-test";
const historyId = `${md5(testId)}.${md5("")}`;
const readerId = "flakyDetection.test.ts";
const rawResult: RawTestResult = {
  uuid: "current-result",
  testId,
  name: "example test",
  status: "failed",
  labels: [{ name: "owner", value: "example-team" }],
};

let directory: string;
let reports: AllureReport[];

beforeEach(async () => {
  await epic("coverage");
  await feature("flakiness-and-transitions");
  await story("flaky detection configuration");
  await label("coverage", "flakiness-and-transitions");
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

const createReport = async (flakyDetection?: Config["flakyDetection"], statuses?: TestStatus[]) => {
  const historyPath = statuses === undefined ? undefined : join(directory, "history.jsonl");

  if (historyPath && statuses) {
    const points: HistoryDataPoint[] = statuses.map((status, index) => ({
      uuid: `launch-${index}`,
      name: "previous launch",
      timestamp: statuses.length - index,
      knownTestCaseIds: [],
      metrics: {},
      url: "",
      testResults: {
        [historyId]: {
          id: `historical-result-${index}`,
          name: "example test",
          status,
          url: "",
        },
      },
    }));

    await writeFile(
      historyPath,
      points
        .reverse()
        .map((point) => JSON.stringify(point))
        .join("\n"),
    );
  }

  const config = await resolveConfig(
    {
      output: join(directory, "report"),
      historyPath,
      appendHistory: false,
      ...(flakyDetection === undefined ? {} : { flakyDetection }),
    },
    { plugins: {} },
  );
  const report = new AllureReport(config);

  await report.start();
  reports.push(report);

  return report;
};

describe("flaky detection configuration", () => {
  it.each([
    { historyDepth: undefined, expected: false },
    { historyDepth: 5, expected: false },
    { historyDepth: 6, expected: true },
    { historyDepth: 10, expected: true },
  ])("uses historyDepth=$historyDepth for the built-in algorithm", async ({ historyDepth, expected }) => {
    const report = await createReport({ historyDepth }, ["passed", "passed", "passed", "passed", "passed", "failed"]);

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(expected);
    expect(result.transition).toBe("regressed");
  });

  it.each([0, 1])("excludes older failures with historyDepth=%s", async (historyDepth) => {
    const report = await createReport({ historyDepth }, ["passed", "failed"]);

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(false);
    expect(result.transition).toBe("regressed");
    await expect(report.store.historyByTr(result)).resolves.toHaveLength(2);
  });

  it("preserves the integration flag when historyDepth is zero", async () => {
    const report = await createReport({ historyDepth: 0 }, ["passed", "failed"]);

    await report.store.visitTestResult({ ...rawResult, flaky: true }, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(true);
  });

  it.each([
    { statuses: ["passed", "failed"], status: "failed", explicit: false, expected: true },
    { statuses: ["passed", "failed"], status: "broken", explicit: false, expected: true },
    { statuses: ["passed", "failed"], status: "passed", explicit: false, expected: false },
    { statuses: ["passed", "broken"], status: "failed", explicit: false, expected: false },
    {
      statuses: ["passed", "passed", "passed", "passed", "passed", "failed"],
      status: "failed",
      explicit: false,
      expected: false,
    },
    { statuses: undefined, status: "passed", explicit: true, expected: true },
    { statuses: undefined, status: "failed", explicit: false, expected: false },
  ] satisfies { statuses?: TestStatus[]; status: TestStatus; explicit: boolean; expected: boolean }[])(
    "preserves default detection for status=$status, history=$statuses, explicit=$explicit",
    async ({ statuses, status, explicit, expected }) => {
      const report = await createReport(undefined, statuses);

      await report.store.visitTestResult({ ...rawResult, status, flaky: explicit }, { readerId });

      const [result] = await report.store.allTestResults();

      expect(result.flaky).toBe(expected);
      if (statuses === undefined) {
        expect(result.transition).toBeUndefined();
      }
    },
  );

  it.each([false, true])("lets the override veto flakiness with explicit=%s", async (explicit) => {
    const report = await createReport({ overrideFunction: async () => false }, ["passed", "failed"]);

    await report.store.visitTestResult({ ...rawResult, flaky: explicit }, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(false);
  });

  it.each([0, 1])("passes full history to the override despite historyDepth=%s", async (historyDepth) => {
    let receivedResult: TestResult | undefined;
    let receivedHistory: HistoryTestResult[] | undefined;
    const report = await createReport(
      {
        historyDepth,
        overrideFunction: async (result, history) => {
          receivedResult = { ...result };
          receivedHistory = history;
          return history.length === 6 && history[5].status === "failed";
        },
      },
      ["passed", "passed", "passed", "passed", "passed", "failed"],
    );

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(true);
    expect(receivedResult).toMatchObject({
      id: md5("current-result"),
      name: "example test",
      status: "failed",
      flaky: false,
      environment: "default",
      transition: "regressed",
      labels: [{ name: "owner", value: "example-team" }],
      sourceMetadata: { readerId },
    });
    expect(receivedHistory?.map(({ id }) => id)).toEqual([
      "historical-result-0",
      "historical-result-1",
      "historical-result-2",
      "historical-result-3",
      "historical-result-4",
      "historical-result-5",
    ]);
  });

  it.each([{ statuses: undefined }, { statuses: [] }] satisfies { statuses?: TestStatus[] }[])(
    "runs the override when history is $statuses",
    async ({ statuses }) => {
      const report = await createReport(
        {
          overrideFunction: (result, history) => result.status === "passed" && history.length === 0,
        },
        statuses,
      );

      await report.store.visitTestResult({ ...rawResult, status: "passed" }, { readerId });

      const [result] = await report.store.allTestResults();

      expect(result.flaky).toBe(true);
    },
  );

  it.each([undefined, null, "true", 1, Promise.resolve("true")])(
    "rejects a non-boolean override result: %s",
    async (value) => {
      const report = await createReport({ overrideFunction: () => value as unknown as boolean });

      await expect(report.store.visitTestResult(rawResult, { readerId })).rejects.toThrow(/must return a boolean/);
      await expect(report.store.allTestResults()).resolves.toEqual([]);
    },
  );

  it.each([-1, 1.5, NaN, Infinity])("rejects invalid historyDepth=%s when resolving config", async (historyDepth) => {
    await expect(resolveConfig({ flakyDetection: { historyDepth } }, { plugins: {} })).rejects.toThrow(
      /historyDepth.*non-negative integer/,
    );
  });

  it("rejects an override that is not a function when resolving config", async () => {
    await expect(
      resolveConfig({ flakyDetection: { overrideFunction: true as unknown as () => boolean } }, { plugins: {} }),
    ).rejects.toThrow(/overrideFunction.*function/);
  });
});
