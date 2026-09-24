import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig, type PluginInstance } from "@allurereport/core";
import type { TestResult } from "@allurereport/core-api";
import { createPluginSummary } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generate } from "../../../src/commands/commons/generate.js";

const md5 = (value: string): string => createHash("md5").update(value).digest("hex");

const summaryPlugin = (id: string, filter?: (tr: TestResult) => boolean): PluginInstance => ({
  id,
  enabled: true,
  options: {},
  plugin: {
    done: async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("<html>Report</html>"));
    },
    info: (context, store) =>
      createPluginSummary({
        name: context.reportName,
        plugin: id,
        store,
        history: context.history,
        filter,
        meta: {},
      }),
  },
});

const writeAllureResult = async (
  resultsDir: string,
  result: { uuid: string; testCaseId: string; status: "passed" | "failed"; start: number; duration: number },
) => {
  await writeFile(
    join(resultsDir, `${result.uuid}-result.json`),
    JSON.stringify({
      uuid: result.uuid,
      name: `${result.testCaseId} test`,
      fullName: `native.${result.testCaseId}`,
      testCaseId: result.testCaseId,
      status: result.status,
      start: result.start,
      stop: result.start + result.duration,
    }),
  );
};

const tempDirs: string[] = [];

const setup = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "allure-generated-summary-"));
  tempDirs.push(tempDir);
  const resultsDir = join(tempDir, "allure-results");
  await mkdir(resultsDir);
  const config = await resolveConfig(
    {
      name: "Native Retry Report",
      output: join(tempDir, "report"),
      historyPath: join(tempDir, "history.jsonl"),
      historyBaseUrl: "https://example.test/allure-report/",
    },
    { plugins: {} },
  );

  return { tempDir, resultsDir, config };
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("generated report summary", () => {
  it.each(["flattened", "multiple", "filtered"] as const)(
    "reads finalized %s reports without counting retries or overlapping summaries twice",
    async (layout) => {
      const { tempDir, resultsDir, config } = await setup();
      await writeAllureResult(resultsDir, {
        uuid: "retry-b",
        testCaseId: "b",
        status: "failed",
        start: 100,
        duration: 10,
      });
      await writeAllureResult(resultsDir, { uuid: "b", testCaseId: "b", status: "passed", start: 200, duration: 30 });
      await writeAllureResult(resultsDir, { uuid: "a", testCaseId: "a", status: "failed", start: 300, duration: 40 });
      config.plugins = [summaryPlugin("awesome")];
      if (layout !== "flattened") {
        config.plugins.push(
          summaryPlugin("second", layout === "filtered" ? (tr) => tr.status === "failed" : undefined),
        );
      }

      const result = await generate({ cwd: tempDir, config, resultsDir: [resultsDir], collectSummary: true });
      const summary = result?.summary;

      expect(summary?.totals).toEqual({
        duration: 70,
        stats: { total: 2, passed: 1, failed: 1, broken: 0, skipped: 0, unknown: 0 },
        flags: { new: 2, flaky: 0, retry: 1 },
        resolutions: { issues: 0, muted: 0, accepted: 0 },
      });
      expect(Object.keys(summary!.testResults!.byId).sort()).toEqual([md5("a"), md5("b")]);
      expect(summary?.reports).toHaveLength(layout === "flattened" ? 1 : 2);
      expect(summary?.reports.find(({ plugin }) => plugin === "awesome")).toMatchObject({
        reportPath: layout === "flattened" ? "" : "awesome",
        newTests: expect.arrayContaining([md5("a"), md5("b")]),
      });
      if (layout === "filtered") {
        expect(summary?.reports.find(({ plugin }) => plugin === "second")).toMatchObject({
          filtered: true,
          reportPath: "second",
          newTests: [md5("a")],
          stats: { total: 1, failed: 1 },
        });
      }
      const history = (await readFile(config.historyPath!, "utf8")).trim().split("\n");
      expect(history).toHaveLength(1);
      expect(Object.keys(JSON.parse(history[0]).testResults)).toHaveLength(2);
    },
  );

  it("warns about malformed optional summaries while retaining statistics from the generated registry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tempDir, resultsDir, config } = await setup();
    await writeAllureResult(resultsDir, { uuid: "a", testCaseId: "a", status: "passed", start: 100, duration: 40 });
    config.plugins = [
      {
        id: "custom",
        enabled: true,
        options: {},
        plugin: {
          done: async (context) => {
            await context.reportFiles.addFile("index.html", Buffer.from("<html>Report</html>"));
            await context.reportFiles.addFile("summary.json", Buffer.from("{invalid json"));
          },
        },
      },
    ];

    const result = await generate({ cwd: tempDir, config, resultsDir: [resultsDir], collectSummary: true });

    expect(result?.summary?.totals.stats).toEqual({
      total: 1,
      passed: 1,
      failed: 0,
      broken: 0,
      skipped: 0,
      unknown: 0,
    });
    expect(result?.summary?.reports).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to read Allure report context file"));
  });

  it("returns a valid empty context rather than treating an empty report as missing data", async () => {
    const { tempDir, resultsDir, config } = await setup();
    config.plugins = [summaryPlugin("awesome")];

    const result = await generate({ cwd: tempDir, config, resultsDir: [resultsDir], collectSummary: true });

    expect(result?.summary?.testResults).toEqual({ byId: {} });
    expect(result?.summary?.totals).toEqual({
      duration: 0,
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      flags: { new: 0, flaky: 0, retry: 0 },
      resolutions: { issues: 0, muted: 0, accepted: 0 },
    });
  });
});
