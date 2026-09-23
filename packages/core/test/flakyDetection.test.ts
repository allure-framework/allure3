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

type HistoricalResult = Pick<HistoryTestResult, "status" | "environment"> & Partial<Pick<HistoryTestResult, "id">>;

const createReport = async (
  flakyDetection?: Config["flakyDetection"],
  statuses?: (TestStatus | HistoricalResult)[],
) => {
  const historyPath = statuses === undefined ? undefined : join(directory, "history.jsonl");

  if (historyPath && statuses) {
    const points: HistoryDataPoint[] = statuses.map((result, index) => ({
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
          url: "",
          ...(typeof result === "string" ? { status: result, environment: "default" } : result),
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

describe("weighted transition detection", () => {
  const statusBySymbol: Record<string, TestStatus> = {
    P: "passed",
    F: "failed",
    B: "broken",
    S: "skipped",
    U: "unknown",
  };

  // Sequences are oldest first, including the current execution as the last symbol.
  it.each([
    { sequence: "F", expected: false },
    { sequence: "PF", expected: false },
    { sequence: "FPF", expected: true },
    { sequence: "PPPPPF", expected: false },
    { sequence: "PFPPPF", expected: false },
    { sequence: "PPPFPF", expected: true },
    { sequence: "PFFPPF", expected: true },
    { sequence: "PFPFPF", expected: true },
    { sequence: "FPFFFF", expected: false },
    { sequence: "FFFFPF", expected: false },
    { sequence: "FPFP", expected: false },
    { sequence: "PFPFPS", expected: false },
    { sequence: "PFPFPU", expected: false },
    { sequence: "BPB", expected: true },
    { sequence: "BPF", expected: true },
    { sequence: "FPB", expected: true },
    { sequence: "FBFBFB", expected: false },
  ])("classifies $sequence as flaky=$expected", async ({ sequence, expected }) => {
    const statuses = [...sequence].map((symbol) => statusBySymbol[symbol]);
    const report = await createReport(undefined, statuses.slice(0, -1).reverse());

    await report.store.visitTestResult({ ...rawResult, status: statuses[statuses.length - 1] }, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(expected);
  });

  it.each([
    { sequence: "P", expected: false },
    { sequence: "FP", expected: false },
    { sequence: "PFP", expected: true },
    { sequence: "PBP", expected: true },
    { sequence: "FPFP", expected: true },
    { sequence: "PPPPPP", expected: false },
    { sequence: "FPFFFP", expected: false },
    { sequence: "FFFPFP", expected: true },
    { sequence: "FPPFFP", expected: true },
    { sequence: "PPPPFP", expected: false },
    { sequence: "FPF", expected: true },
    { sequence: "FPB", expected: true },
    { sequence: "PFPFPS", expected: false },
    { sequence: "PFPFPU", expected: false },
  ])("classifies $sequence as flaky=$expected when passed tests are included", async ({ sequence, expected }) => {
    const statuses = [...sequence].map((symbol) => statusBySymbol[symbol]);
    const report = await createReport({ includePassedTests: true }, statuses.slice(0, -1).reverse());

    await report.store.visitTestResult({ ...rawResult, status: statuses[statuses.length - 1] }, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(expected);
  });

  it.each(["skipped", "unknown"] as const)(
    "ignores %s outcomes without consuming history depth or transition weight",
    async (ignoredStatus) => {
      const report = await createReport({ historyDepth: 2 }, [ignoredStatus, "passed", ignoredStatus, "failed"]);

      await report.store.visitTestResult(rawResult, { readerId });

      const [result] = await report.store.allTestResults();

      expect(result.flaky).toBe(true);
    },
  );

  it.each([
    {
      name: "a pass in another environment",
      history: [
        { status: "passed", environment: "other" },
        { status: "failed", environment: "default" },
      ],
    },
    {
      name: "a failure in another environment",
      history: [
        { status: "passed", environment: "default" },
        { status: "failed", environment: "other" },
      ],
    },
    {
      name: "a pass without an environment",
      history: [{ status: "passed" }, { status: "failed", environment: "default" }],
    },
    {
      name: "a failure without an environment",
      history: [{ status: "passed", environment: "default" }, { status: "failed" }],
    },
  ] satisfies { name: string; history: HistoricalResult[] }[])("excludes $name", async ({ history }) => {
    const report = await createReport(undefined, history);

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(false);
  });

  it("filters other environments before applying history depth", async () => {
    const report = await createReport({ historyDepth: 2 }, [
      { status: "failed", environment: "other" },
      { status: "passed", environment: "other" },
      "passed",
      "failed",
    ]);

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(true);
  });

  it("does not count a copy of the current execution against history depth", async () => {
    const report = await createReport({ historyDepth: 2 }, [
      { id: md5("current-result"), status: "failed", environment: "default" },
      "passed",
      "failed",
    ]);

    await report.store.visitTestResult(rawResult, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(true);
  });
});

describe("flaky detection configuration", () => {
  it.each([
    { includePassedTests: undefined, historyDepth: undefined, expected: false },
    { includePassedTests: false, historyDepth: undefined, expected: false },
    { includePassedTests: true, historyDepth: undefined, expected: true },
    { includePassedTests: true, historyDepth: 0, expected: false },
    { includePassedTests: true, historyDepth: 1, expected: false },
    { includePassedTests: true, historyDepth: 2, expected: true },
  ])(
    "evaluates passed tests with includePassedTests=$includePassedTests and historyDepth=$historyDepth",
    async ({ includePassedTests, historyDepth, expected }) => {
      const report = await createReport({ includePassedTests, historyDepth }, ["failed", "passed"]);

      await report.store.visitTestResult({ ...rawResult, status: "passed" }, { readerId });

      const [result] = await report.store.allTestResults();

      expect(result.status).toBe("passed");
      expect(result.flaky).toBe(expected);
    },
  );

  it.each([
    { includePassedTests: false, overrideFunction: () => true, expected: true },
    { includePassedTests: true, overrideFunction: () => false, expected: false },
  ])("lets the override replace includePassedTests=$includePassedTests", async ({ expected, ...flakyDetection }) => {
    const report = await createReport(flakyDetection, ["failed", "passed"]);

    await report.store.visitTestResult({ ...rawResult, status: "passed" }, { readerId });

    const [result] = await report.store.allTestResults();

    expect(result.flaky).toBe(expected);
  });

  it.each([
    { historyDepth: undefined, expected: false },
    { historyDepth: 5, expected: false },
    { historyDepth: 6, expected: true },
    { historyDepth: 10, expected: true },
  ])("uses historyDepth=$historyDepth for the built-in algorithm", async ({ historyDepth, expected }) => {
    const report = await createReport({ historyDepth }, ["passed", "failed", "failed", "failed", "failed", "passed"]);

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
    { statuses: ["passed", "broken"], status: "failed", explicit: false, expected: true },
    {
      statuses: ["passed", "passed", "passed", "passed", "passed", "failed"],
      status: "failed",
      explicit: false,
      expected: false,
    },
    { statuses: undefined, status: "passed", explicit: true, expected: true },
    { statuses: undefined, status: "failed", explicit: false, expected: false },
  ] satisfies { statuses?: TestStatus[]; status: TestStatus; explicit: boolean; expected: boolean }[])(
    "uses weighted default detection for status=$status, history=$statuses, explicit=$explicit",
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

  it.each([
    { includePassedTests: null },
    { includePassedTests: 0 },
    { includePassedTests: 1 },
    { includePassedTests: "false" },
    { includePassedTests: "true" },
    { includePassedTests: {} },
    { includePassedTests: [] },
  ])(
    "rejects non-boolean includePassedTests=$includePassedTests when resolving config",
    async ({ includePassedTests }) => {
      await expect(
        resolveConfig(
          { flakyDetection: { includePassedTests: includePassedTests as unknown as boolean } },
          { plugins: {} },
        ),
      ).rejects.toThrow(/includePassedTests.*boolean/);
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
