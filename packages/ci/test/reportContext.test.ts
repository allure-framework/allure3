import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PluginSummary, TestResultRegistry } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";

import { createReportContext, createReportContextFromData } from "../src/reportContext.js";

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, JSON.stringify(value), "utf8");
};

const createSummary = (overrides: Partial<PluginSummary> = {}): PluginSummary => ({
  name: "Awesome report",
  plugin: "awesome",
  pluginId: "awesome",
  remoteHref: "https://example.org/awesome",
  stats: {
    total: 4,
    passed: 2,
    failed: 1,
    skipped: 1,
    resolutions: {
      issues: 1,
      muted: 2,
      accepted: 3,
    },
  },
  status: "failed",
  duration: 42,
  newTests: ["1", "2"],
  flakyTests: ["3"],
  retryTests: ["1", "4"],
  meta: {
    withTestResultsLinks: true,
  },
  ...overrides,
});

describe("report context", () => {
  it("should create a platform-neutral context from generated report files", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure-report-context-"));
    const awesomeDir = join(output, "awesome");
    const classicDir = join(output, "classic");
    const widgetsDir = join(output, "awesome", "widgets");
    const registry: TestResultRegistry = {
      byId: {
        "1": { id: "1", name: "passed", duration: 10, status: "passed", environment: "ubuntu" },
        "2": { id: "2", name: "failed", duration: 20, status: "failed", environment: "ubuntu" },
        "3": { id: "3", name: "skipped", duration: 30, status: "skipped", environment: "windows" },
        "4": { id: "4", name: "default env", duration: 40, status: "passed", environment: "default" },
        "5": { id: "5", name: "not finished yet" },
        "6": "garbage",
      },
    };

    await mkdir(awesomeDir, { recursive: true });
    await mkdir(classicDir, { recursive: true });
    await mkdir(widgetsDir, { recursive: true });
    await writeJson(join(awesomeDir, "summary.json"), createSummary());
    await writeJson(
      join(classicDir, "summary.json"),
      createSummary({
        name: "Classic report",
        plugin: "classic",
        pluginId: "classic",
        remoteHref: "https://example.org/classic",
        stats: { total: 4, passed: 2, failed: 1, skipped: 1 },
      }),
    );
    await writeJson(join(widgetsDir, "summary.json"), { not: "a plugin summary" });
    await writeJson(join(output, "test-results.json"), registry);
    await writeJson(join(output, "artifacts.json"), [
      { name: "stage.log", path: "artifacts/stage.log" },
      { name: "duplicate.log", path: "artifacts/stage.log" },
      { name: "dump.zip", path: "dumps/linux.zip" },
    ]);
    await writeJson(join(output, "quality-gate.json"), [
      {
        success: false,
        expected: 0,
        actual: 1,
        rule: "maxFailures",
        message: "Failed tests exceed threshold",
        testResults: ["2"],
      },
      { success: "yes", rule: 42 },
    ]);

    const context = await createReportContext(output);

    expect(context.reports).toEqual([
      expect.objectContaining({
        name: "Awesome report",
        plugin: "awesome",
        pluginId: "awesome",
        summaryFile: join(awesomeDir, "summary.json"),
        reportPath: "awesome",
        remoteHref: "https://example.org/awesome",
      }),
      expect.objectContaining({
        name: "Classic report",
        plugin: "classic",
        pluginId: "classic",
        summaryFile: join(classicDir, "summary.json"),
        reportPath: "classic",
        remoteHref: "https://example.org/classic",
      }),
    ]);
    expect(context.totals).toEqual({
      stats: {
        failed: 1,
        broken: 0,
        passed: 2,
        skipped: 1,
        unknown: 0,
        total: 4,
      },
      flags: {
        new: 2,
        flaky: 1,
        retry: 2,
      },
      resolutions: {
        issues: 1,
        muted: 2,
        accepted: 3,
      },
      duration: 100,
    });
    expect(context.testResults).toEqual(registry);
    expect(context.environments).toEqual([
      {
        name: "ubuntu",
        stats: {
          failed: 1,
          broken: 0,
          passed: 1,
          skipped: 0,
          unknown: 0,
          total: 2,
        },
        flags: {
          new: 2,
          flaky: 0,
          retry: 1,
        },
        duration: 30,
      },
      {
        name: "windows",
        stats: {
          failed: 0,
          broken: 0,
          passed: 0,
          skipped: 1,
          unknown: 0,
          total: 1,
        },
        flags: {
          new: 0,
          flaky: 1,
          retry: 0,
        },
        duration: 30,
      },
    ]);
    expect(context.artifacts).toEqual([
      { name: "stage.log", path: "artifacts/stage.log" },
      { name: "dump.zip", path: "dumps/linux.zip" },
    ]);
    expect(context.qualityGate).toEqual([
      expect.objectContaining({
        success: false,
        rule: "maxFailures",
      }),
    ]);
  });

  it("should fall back to summary stats for a root-level summary without a test result registry", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure-report-context-root-summary-"));

    await writeJson(
      join(output, "summary.json"),
      createSummary({
        name: "Standalone report",
        stats: { total: 4, passed: 3, failed: 1, broken: 0, skipped: 0, unknown: 0 },
      }),
    );

    const context = await createReportContext(output);

    expect(context.reports).toEqual([
      expect.objectContaining({
        name: "Standalone report",
        summaryFile: join(output, "summary.json"),
        reportPath: "",
      }),
    ]);
    expect(context.testResults).toBeUndefined();
    expect(context.totals.stats).toEqual({
      failed: 1,
      broken: 0,
      passed: 3,
      skipped: 0,
      unknown: 0,
      total: 4,
    });
    expect(context.totals.duration).toBe(42);
    expect(context.environments).toEqual([]);
  });

  it("should create context from in-memory data without report files", () => {
    const registry: TestResultRegistry = {
      byId: {
        "1": { id: "1", name: "passed", duration: 10, status: "passed", environment: "ubuntu" },
        "2": { id: "2", name: "failed", duration: 20, status: "failed", environment: "ubuntu" },
      },
    };

    const context = createReportContextFromData({
      summaries: [createSummary({ name: "GitLab report", newTests: ["2"], flakyTests: [], retryTests: [] })],
      testResults: registry,
      artifacts: [{ name: "dump.zip", path: "dumps/linux.zip" }],
      qualityGate: [
        {
          success: false,
          expected: 0,
          actual: 1,
          rule: "maxFailures",
          message: "Failed tests exceed threshold",
          testResults: ["2"],
        },
      ],
    });

    expect(context.reports).toEqual([expect.objectContaining({ name: "GitLab report" })]);
    expect(context.reports[0]).not.toHaveProperty("summaryFile");
    expect(context.reports[0]).not.toHaveProperty("reportPath");
    expect(context.totals.stats).toEqual({
      failed: 1,
      broken: 0,
      passed: 1,
      skipped: 0,
      unknown: 0,
      total: 2,
    });
    expect(context.environments).toEqual([
      expect.objectContaining({
        name: "ubuntu",
        flags: {
          new: 1,
          flaky: 0,
          retry: 0,
        },
      }),
    ]);
    expect(context.artifacts).toEqual([{ name: "dump.zip", path: "dumps/linux.zip" }]);
    expect(context.qualityGate).toEqual([
      expect.objectContaining({
        success: false,
        rule: "maxFailures",
      }),
    ]);
  });

  it("should normalize incomplete plugin summaries without failing", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure-report-context-incomplete-summary-"));
    const unnamedDir = join(output, "unnamed");
    const withoutStatsDir = join(output, "without-stats");

    await mkdir(unnamedDir, { recursive: true });
    await mkdir(withoutStatsDir, { recursive: true });
    await writeJson(join(unnamedDir, "summary.json"), {
      ...createSummary(),
      name: undefined,
    });
    await writeJson(join(withoutStatsDir, "summary.json"), {
      name: "Report without stats",
      status: "passed",
      duration: 12,
      remoteHref: "https://example.org/without-stats",
    });

    const contextFromFiles = await createReportContext(output);
    const contextFromData = createReportContextFromData({
      summaries: [
        {
          ...createSummary({ name: "Named report" }),
        },
        {
          ...createSummary(),
          name: undefined,
        } as unknown as PluginSummary,
        {
          name: "Report without stats",
          status: "passed",
          duration: 12,
          remoteHref: "https://example.org/without-stats",
        } as unknown as PluginSummary,
      ],
    });

    expect(contextFromFiles.reports.map(({ name }) => name)).toEqual(["Allure Report", "Report without stats"]);
    expect(contextFromFiles.reports[1].stats).toEqual({
      failed: 0,
      broken: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
      total: 0,
    });
    expect(contextFromData.reports.map(({ name }) => name)).toEqual([
      "Allure Report",
      "Named report",
      "Report without stats",
    ]);
  });

  it("should ignore missing or malformed optional files without failing", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure-report-context-malformed-"));
    const errors: string[] = [];

    await writeFile(join(output, "test-results.json"), "{", "utf8");
    await writeJson(join(output, "artifacts.json"), { artifacts: [] });
    await writeJson(join(output, "quality-gate.json"), { success: true });

    const context = await createReportContext(output, { onError: (message) => errors.push(message) });

    expect(context).toEqual({
      reports: [],
      testResults: undefined,
      totals: {
        stats: {
          failed: 0,
          broken: 0,
          passed: 0,
          skipped: 0,
          unknown: 0,
          total: 0,
        },
        flags: {
          new: 0,
          flaky: 0,
          retry: 0,
        },
        resolutions: {
          issues: 0,
          muted: 0,
          accepted: 0,
        },
        duration: 0,
      },
      environments: [],
      artifacts: [],
      qualityGate: undefined,
    });
    expect(errors).toEqual([
      expect.stringContaining("Failed to read Allure report context file"),
      "Ignoring unsupported Allure artifacts manifest shape",
      "Ignoring unsupported Allure quality gate results shape",
    ]);
  });

  it("should preserve environment-keyed quality gate results", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure-report-context-qg-env-"));

    await writeJson(join(output, "quality-gate.json"), {
      ubuntu: [
        {
          success: false,
          expected: 0,
          actual: 1,
          rule: "maxFailures",
          message: "Failed tests exceed threshold",
          testResults: ["1"],
        },
      ],
      windows: [{ success: true, expected: 1, actual: 1, rule: "minTestsCount", message: "ok", testResults: [] }],
    });

    const context = await createReportContext(output);

    expect(context.qualityGate).toEqual({
      ubuntu: [
        {
          success: false,
          expected: 0,
          actual: 1,
          rule: "maxFailures",
          message: "Failed tests exceed threshold",
          testResults: ["1"],
        },
      ],
      windows: [{ success: true, expected: 1, actual: 1, rule: "minTestsCount", message: "ok", testResults: [] }],
    });
  });
});
