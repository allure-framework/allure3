import console from "node:console";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

import type { TestResult } from "@allurereport/core-api";
import type { Plugin, QualityGateRule } from "@allurereport/plugin-api";
import { BufferResultFile, type ResultsReader } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";
import { Attachment, epic, feature, label, step, story } from "allure-js-commons";
import type { Mock, Mocked } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/index.js";
import { writeQuarantine } from "../src/known.js";
import { AllureReport } from "../src/report.js";
import { PERF_METRICS_FILE, PERF_METRIC_NAMES, PERF_METRIC_PREFIXES, resetPerfMetrics } from "../src/utils/perf.js";
import { AllureServiceClientMock } from "./utils.js";

// Token payload: { "accessToken": "ELzFh8...", "url": "http://localhost:3000" }
const validAccessToken =
  "ars1.eyJhY2Nlc3NUb2tlbiI6IkVMekZoOFZvaENXeXRrTFlGZ0U2QzVtTS1DWTlyWnd2ZXVYMkRlbmtkTm8iLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAifQ.OEwujL5WsTP0TQ8nFxrUauKfRLslw-S2ZFnlgFPTwO8";
const defaultUploadConfig = {
  uploadConcurrency: 100,
  uploadMaxAttempts: 5,
  uploadMaxSimultaneousFailures: 5,
};
const allureServiceConfig = (overrides: Partial<typeof defaultUploadConfig> = {}) => ({
  accessToken: validAccessToken,
  ...defaultUploadConfig,
  ...overrides,
});

vi.mock("@allurereport/service", async (importOriginal) => {
  const utils = await import("./utils.js");

  return {
    ...(await importOriginal()),
    AllureServiceClient: utils.AllureServiceClientMock,
  };
});
vi.mock("@allurereport/ci", () => ({
  detect: vi.fn().mockReturnValue({
    repoName: "allure3",
    jobRunBranch: "main",
  }),
}));
vi.mock("../src/known.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/known.js")>();

  return {
    ...actual,
    writeQuarantine: vi.fn().mockResolvedValue(undefined),
  };
});

const createPlugin = (id: string, enabled: boolean = true, options: Record<string, any> = {}) => {
  const plugin: Mocked<Required<Plugin>> = {
    start: vi.fn<Required<Plugin>["start"]>(),
    update: vi.fn<Required<Plugin>["update"]>(),
    done: vi.fn<Required<Plugin>["done"]>(),
    info: vi.fn<Required<Plugin>["info"]>(),
  };

  return {
    id,
    enabled,
    options,
    plugin,
  };
};

const createSignal = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

let previousCwd: string;

beforeEach(async () => {
  await epic("coverage");
  await feature("report-engine");
  await story("report");
  await label("coverage", "report-engine");
  previousCwd = process.cwd();
  vi.clearAllMocks();
  (AllureServiceClientMock.prototype.createReport as Mock).mockResolvedValue(
    new URL("https://allurereport.com/reports"),
  );
  (AllureServiceClientMock.prototype.uploadReport as Mock).mockImplementation(
    ({ pluginId, files }: { pluginId?: string; files: Record<string, string> }) => ({
      indexHref:
        pluginId && files["index.html"]
          ? `https://example.org/${pluginId}/index.html`
          : files["index.html"]
            ? "https://example.org/index.html"
            : undefined,
      hrefs: {},
    }),
  );
});

afterEach(() => {
  process.chdir(previousCwd);
  delete process.env.ALLURE_PERF_METRICS;
  resetPerfMetrics();
});

describe("report", () => {
  it("should not fail with the empty report", async () => {
    const config = await resolveConfig(
      {
        name: "Allure Report",
      },
      { plugins: {} },
    );

    const allureReport = new AllureReport(config);

    await step("complete empty report lifecycle without plugins", async () => {
      await expect(allureReport.start()).resolves.toBeUndefined();
      await expect(allureReport.done()).resolves.toBeUndefined();
    });
  });

  it("should not allow call done() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.done()).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readDirectory() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.readDirectory("any")).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readFile() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    await expect(() => allureReport.readFile("any")).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should not allow to readResult() before start()", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);
    const resultFile = new BufferResultFile(Buffer.from("some content", "utf-8"), "some-name.txt");
    await expect(() => allureReport.readResult(resultFile)).rejects.toThrowError(
      "report is not initialised. Call the start() method first",
    );
  });

  it("should skip readers whose matcher rejects the result file", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });
    const rejectedReader: ResultsReader = {
      matches: vi.fn().mockReturnValue(false),
      read: vi.fn().mockResolvedValue(true),
      readerId: () => "rejected",
    };
    const acceptedReader: ResultsReader = {
      matches: vi.fn().mockReturnValue(true),
      read: vi.fn().mockResolvedValue(true),
      readerId: () => "accepted",
    };
    const allureReport = new AllureReport({
      ...config,
      readers: [rejectedReader, acceptedReader],
    });
    const resultFile = new BufferResultFile(Buffer.from("some content", "utf-8"), "some-name.txt");

    await allureReport.start();
    await allureReport.readResult(resultFile);

    expect(rejectedReader.matches).toHaveBeenCalledWith(resultFile);
    expect(rejectedReader.read).not.toHaveBeenCalled();
    expect(acceptedReader.read).toHaveBeenCalledWith(allureReport.store, resultFile);
  });

  it("should not touch the history file when appendHistory is false", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-append-history-"));
    const historyPath = join(await mkdtemp(join(tmpdir(), "allure3-append-history-data-")), "history.jsonl");
    const initialHistoryContent = `${JSON.stringify({ uuid: "existing", name: "Existing run", timestamp: 1, knownTestCaseIds: [], metrics: {}, testResults: {} })}\n`;

    await writeFile(historyPath, initialHistoryContent, "utf-8");

    const config = await resolveConfig({
      name: "Allure Report",
      output,
      historyPath,
      appendHistory: false,
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    expect(await readFile(historyPath, "utf-8")).toEqual(initialHistoryContent);
  });

  it("should append to the history file when appendHistory is true", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-append-history-"));
    const historyPath = join(await mkdtemp(join(tmpdir(), "allure3-append-history-data-")), "history.jsonl");
    const initialHistoryContent = `${JSON.stringify({ uuid: "existing", name: "Existing run", timestamp: 1, knownTestCaseIds: [], metrics: {}, testResults: {} })}\n`;

    await writeFile(historyPath, initialHistoryContent, "utf-8");

    const config = await resolveConfig({
      name: "Allure Report",
      output,
      historyPath,
      appendHistory: true,
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    const historyContent = await readFile(historyPath, "utf-8");

    expect(historyContent).not.toEqual(initialHistoryContent);
    expect(historyContent.startsWith(initialHistoryContent)).toBe(true);
  });

  it("should write quarantine for default path", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    expect(writeQuarantine).toHaveBeenCalledWith(allureReport.store, resolve("./quarantine.json"));
  });

  it("should write quarantine only from quarantine path", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-known-issues-"));
    const config = await resolveConfig({
      name: "Allure Report",
      output,
      knownIssuesPath: "./known-issues.json",
      quarantinePath: "./quarantine.json",
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.store.visitTestResult(
      {
        name: "failed test",
        status: "failed",
        testId: "quarantine-test",
        message: "boom",
      },
      { readerId: "report.test.ts" },
    );

    expect(await allureReport.store.quarantineIssues()).toHaveLength(1);
    await allureReport.done();

    expect(writeQuarantine).toHaveBeenCalledTimes(1);
    expect(writeQuarantine).toHaveBeenCalledWith(allureReport.store, resolve("./quarantine.json"));
  });

  it("should read result directory files with bounded concurrency", async () => {
    const previousConcurrency = process.env.ALLURE_READ_CONCURRENCY;
    const resultsDir = await mkdtemp(join(tmpdir(), "allure3-read-directory-"));
    const config = await resolveConfig({
      name: "Allure Report",
    });
    const readFiles: string[] = [];
    let activeReads = 0;
    let maxActiveReads = 0;
    const reader: ResultsReader = {
      matches: vi.fn().mockReturnValue(true),
      read: vi.fn(async (_visitor, data) => {
        readFiles.push(data.getOriginalFileName());
        activeReads++;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await setTimeout(20);
        activeReads--;

        return true;
      }),
      readerId: () => "bounded",
    };

    process.env.ALLURE_READ_CONCURRENCY = "2";

    try {
      await writeFile(join(resultsDir, "b-result.json"), "{}");
      await writeFile(join(resultsDir, "a-result.json"), "{}");
      await writeFile(join(resultsDir, "c-result.json"), "{}");

      const allureReport = new AllureReport({
        ...config,
        readers: [reader],
      });

      await allureReport.start();
      await allureReport.readDirectory(resultsDir);

      expect([...readFiles].sort()).toEqual(["a-result.json", "b-result.json", "c-result.json"]);
      expect(maxActiveReads).toBe(2);
    } finally {
      if (previousConcurrency === undefined) {
        delete process.env.ALLURE_READ_CONCURRENCY;
      } else {
        process.env.ALLURE_READ_CONCURRENCY = previousConcurrency;
      }
    }
  });

  it("should call plugins in specified order on start()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2");
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();

    expect(p1.plugin.start).toBeCalledTimes(1);
    expect(p2.plugin.start).toBeCalledTimes(1);
    expect(p3.plugin.start).toBeCalledTimes(1);

    expect(p1.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p2.plugin.start.mock.invocationCallOrder[0]);
    expect(p2.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.start.mock.invocationCallOrder[0]);
  });

  it("allows plugin.start to update reportUrl", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2");
    const config = await resolveConfig({
      name: "Allure Report",
    });

    (p1.plugin.start as Mock).mockImplementation(async (context) => {
      context.reportUrl = "https://remote/report";
    });
    (p2.plugin.info as Mock).mockResolvedValue({
      name: "P2",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed",
      duration: 0,
    });
    config.plugins = [p1, p2];

    const allureReport = new AllureReport(config);
    await allureReport.start();
    await allureReport.done();

    expect(allureReport.reportUrl).toEqual("https://remote/report");
  });

  it("should not call disabled plugins on start()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2", false);
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();

    expect(p1.plugin.start).toBeCalledTimes(1);
    expect(p2.plugin.start).toBeCalledTimes(0);
    expect(p3.plugin.start).toBeCalledTimes(1);

    expect(p1.plugin.start.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.start.mock.invocationCallOrder[0]);
  });

  it("should call plugins in specified order on done()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2");
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.done).toBeCalledTimes(1);
    expect(p2.plugin.done).toBeCalledTimes(1);
    expect(p3.plugin.done).toBeCalledTimes(1);

    expect(p1.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p2.plugin.done.mock.invocationCallOrder[0]);
    expect(p2.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.done.mock.invocationCallOrder[0]);
  });

  it("should not call disabled plugins on done()", async () => {
    const p1 = createPlugin("p1");
    const p2 = createPlugin("p2", false);
    const p3 = createPlugin("p3");
    const config = await resolveConfig({
      name: "Allure Report",
    });
    config.plugins?.push(p1, p2, p3);

    const allureReport = new AllureReport(config);
    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.done).toBeCalledTimes(1);
    expect(p2.plugin.done).toBeCalledTimes(0);
    expect(p3.plugin.done).toBeCalledTimes(1);

    expect(p1.plugin.done.mock.invocationCallOrder[0]).toBeLessThan(p3.plugin.done.mock.invocationCallOrder[0]);
  });

  it("should write opt-in generation perf metrics", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    const output = await mkdtemp(join(tmpdir(), "allure3-perf-generation-"));
    const resultsDir = await mkdtemp(join(tmpdir(), "allure3-perf-results-"));
    const p1 = createPlugin("p1");
    const reader: ResultsReader = {
      read: vi.fn(async () => true),
    };
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });

    await writeFile(join(resultsDir, "result.json"), "{}");

    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    config.plugins = [p1];

    const allureReport = new AllureReport({
      ...config,
      readers: [reader],
    });

    await allureReport.start();
    await allureReport.readDirectory(resultsDir);
    await allureReport.done();

    const metrics = JSON.parse(await readFile(join(output, PERF_METRICS_FILE), "utf8"));

    expect(metrics.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERF_METRIC_NAMES.generateTotal, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.generateReadResults, count: 1 }),
        expect.objectContaining({ name: PERF_METRIC_NAMES.generatePluginsDone, count: 1 }),
        expect.objectContaining({ name: `${PERF_METRIC_PREFIXES.generatePluginDone}p1`, count: 1 }),
      ]),
    );
  });

  it("should write opt-in read perf metrics for a single result file", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    const output = await mkdtemp(join(tmpdir(), "allure3-perf-read-file-"));
    const resultsFile = join(await mkdtemp(join(tmpdir(), "allure3-perf-read-file-input-")), "result.json");
    const reader: ResultsReader = {
      read: vi.fn(async () => true),
    };
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });

    await writeFile(resultsFile, "{}");

    const allureReport = new AllureReport({
      ...config,
      readers: [reader],
    });

    await allureReport.start();
    await allureReport.readFile(resultsFile);
    await allureReport.done();

    const metrics = JSON.parse(await readFile(join(output, PERF_METRICS_FILE), "utf8"));

    expect(metrics.summary).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: PERF_METRIC_NAMES.generateReadResults, count: 1 })]),
    );
  });

  it("should write opt-in publishing perf metrics", async () => {
    process.env.ALLURE_PERF_METRICS = "1";

    const output = await mkdtemp(join(tmpdir(), "allure3-perf-publish-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });

    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    config.plugins = [p1];

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    await allureReport.start();
    await allureReport.done();

    const metrics = JSON.parse(await readFile(join(output, PERF_METRICS_FILE), "utf8"));
    const generateTotal = metrics.spans.find(({ name }: { name: string }) => name === PERF_METRIC_NAMES.generateTotal);
    const publishUploadTotal = metrics.spans.find(
      ({ name }: { name: string }) => name === PERF_METRIC_NAMES.publishUploadTotal,
    );

    expect(metrics.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: PERF_METRIC_NAMES.publishUploadTotal, count: 1 }),
        expect.objectContaining({ name: `${PERF_METRIC_PREFIXES.publishUploadPlugin}p1`, count: 1 }),
      ]),
    );
    expect(generateTotal.startTimeMs + generateTotal.durationMs).toBeLessThanOrEqual(publishUploadTotal.startTimeMs);
  });

  it("should upload report files only for plugins with options.publish", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: false });
    const p3 = createPlugin("p3", true);
    const config = await resolveConfig({
      name: "Allure Report",
    });

    config.plugins = [p1, p2, p3];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("p1"));
    });
    (p2.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("p2"));
    });
    (p3.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("p3"));
    });

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock.prototype.createReport).toBeCalledTimes(1);
    expect(AllureServiceClientMock.prototype.uploadReport).toBeCalledTimes(1);
    expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "p1",
        files: expect.objectContaining({ "index.html": expect.any(String) }),
      }),
    );
    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
  });

  it("should skip publish in realtime mode", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
    });

    config.plugins = [p1];

    const allureReport = new AllureReport({
      ...config,
      realTime: true,
      allureService: allureServiceConfig(),
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(0);
    expect(AllureServiceClientMock.prototype.createReport).toBeCalledTimes(0);
    expect(AllureServiceClientMock.prototype.uploadReport).toBeCalledTimes(0);
  });

  it("should still write summary files in realtime mode", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-realtime-summary-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const summary = {
      name: "Plugin summary",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed" as const,
      duration: 0,
    };

    config.plugins = [p1, p2];
    (p1.plugin.info as Mock).mockResolvedValue(summary);
    (p2.plugin.info as Mock).mockResolvedValue(summary);

    const allureReport = new AllureReport({
      ...config,
      realTime: true,
    });

    await allureReport.start();
    await allureReport.done();

    const p1Summary = JSON.parse(await readFile(join(output, "p1", "summary.json"), "utf8"));

    expect(p1Summary.name).toEqual("Plugin summary");
  });

  it("should upload plugin report files via uploadReport", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });

    config.plugins = [p1];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
      await context.reportFiles.addFile("widgets/summary.json", Buffer.from("widget"));
      await context.reportFiles.addFile("app.js", Buffer.from("asset"));
    });
    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledTimes(1);
    expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "p1",
        files: expect.objectContaining({
          "index.html": expect.any(String),
          "widgets/summary.json": expect.any(String),
          "app.js": expect.any(String),
        }),
      }),
    );
  });

  const verifyUploadOptionsForwarding = async (uploadConcurrency?: number) => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });
    const fileCount = 5;

    config.plugins = [p1];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      for (let index = 0; index < fileCount; index++) {
        await context.reportFiles.addFile(`data/file-${index}.json`, Buffer.from(`file-${index}`));
      }
    });
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockResolvedValue({ hrefs: {} });

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(uploadConcurrency === undefined ? {} : { uploadConcurrency }),
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadConcurrency: uploadConcurrency ?? defaultUploadConfig.uploadConcurrency,
      }),
    );
    expect(AllureServiceClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
  };

  it("should forward configured uploadConcurrency to service client", async () => {
    await verifyUploadOptionsForwarding(75);
  });

  it("should use default uploadConcurrency in service client config", async () => {
    await verifyUploadOptionsForwarding();
  });

  it("should write published plugin links to summary files", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-publish-summary-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2");
    const config = await resolveConfig({ name: "Allure Report", output });
    const summary = {
      name: "Plugin summary",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed" as const,
      duration: 0,
    };

    config.plugins = [p1, p2];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    (p1.plugin.info as Mock).mockResolvedValue(summary);
    (p2.plugin.info as Mock).mockResolvedValue(summary);
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockImplementation(
      ({ pluginId, files }: { pluginId?: string; files: Record<string, string> }) => ({
        indexHref: pluginId === "p1" && files["index.html"] ? "https://example.org/p1/index.html" : undefined,
        hrefs: {},
      }),
    );

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    await allureReport.start();
    await allureReport.done();

    const p1Summary = JSON.parse(await readFile(join(output, "p1", "summary.json"), "utf8"));

    expect(p1Summary.remoteHref).toEqual("https://example.org/p1/index.html");
    expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: "p1", files: { "summary.json": expect.any(String) } }),
    );
  });

  it("should restore summaries when remote publish fails after links were resolved", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-publish-failed-summary-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2");
    const config = await resolveConfig({ name: "Allure Report", output });
    const summary = {
      name: "Plugin summary",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed" as const,
      duration: 0,
    };

    config.plugins = [p1, p2];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    (p1.plugin.info as Mock).mockResolvedValue(summary);
    (p2.plugin.info as Mock).mockResolvedValue(summary);
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockImplementation(
      ({ files }: { files: Record<string, string> }) => {
        if (files["summary.json"]) {
          throw new Error("summary upload failed");
        }

        return {
          indexHref: files["index.html"] ? "https://example.org/p1/index.html" : undefined,
          hrefs: {},
        };
      },
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    try {
      await allureReport.start();
      await allureReport.done();

      const p1Summary = JSON.parse(await readFile(join(output, "p1", "summary.json"), "utf8"));

      expect(p1Summary.remoteHref).toBeUndefined();
      expect(AllureServiceClientMock.prototype.deleteReport).toHaveBeenCalledWith({
        reportUuid: allureReport.reportUuid,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should log known publish errors as readable messages", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const publishError = new KnownError(
      "Allure service request failed: POST /api/test-report/report-uuid/upload responded with 401 Unauthorized: API token is expired",
      401,
    );

    config.plugins = [p1];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockRejectedValue(publishError);

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig(),
    });

    try {
      await allureReport.start();
      await allureReport.done();
      expect(consoleError).toHaveBeenCalledWith('Plugin "p1" upload has failed, the plugin won\'t be published');
      expect(consoleError).toHaveBeenCalledWith(publishError.message);
      expect(consoleError).not.toHaveBeenCalledWith(publishError);
      expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledTimes(1);
      expect(AllureServiceClientMock.prototype.deleteReport).toHaveBeenCalledWith({
        reportUuid: allureReport.reportUuid,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should pass configured uploadMaxAttempts to service client", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    config.plugins = [p1];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
    });
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockRejectedValue(new Error("upload failed"));

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig({ uploadMaxAttempts: 2 }),
    });

    try {
      await allureReport.start();
      await allureReport.done();

      expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledTimes(1);
      expect(AllureServiceClientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadMaxAttempts: 2,
        }),
      );
      expect(AllureServiceClientMock.prototype.deleteReport).toHaveBeenCalledWith({
        reportUuid: allureReport.reportUuid,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should pass uploadMaxSimultaneousFailures=0 to service client", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    config.plugins = [p1];
    (p1.plugin.done as Mock).mockImplementation(async (context) => {
      await context.reportFiles.addFile("index.html", Buffer.from("index"));
      await context.reportFiles.addFile("widgets/summary.json", Buffer.from("summary"));
    });
    (AllureServiceClientMock.prototype.uploadReport as Mock).mockRejectedValue(new Error("upload failed"));

    const allureReport = new AllureReport({
      ...config,
      allureService: allureServiceConfig({
        uploadConcurrency: 1,
        uploadMaxAttempts: 10,
        uploadMaxSimultaneousFailures: 0,
      }),
    });

    try {
      await allureReport.start();
      await allureReport.done();

      expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledTimes(1);
      expect(AllureServiceClientMock.prototype.uploadReport).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.objectContaining({ "index.html": expect.any(String) }),
        }),
      );
      expect(AllureServiceClientMock).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadConcurrency: 1,
          uploadMaxAttempts: 10,
          uploadMaxSimultaneousFailures: 0,
        }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should resolve configured environment ids to display names for quality gate results", async () => {
    const mockRule: QualityGateRule<number> = {
      rule: "mockRule",
      message: ({ actual, expected }) => `Mock rule failed with ${actual} vs ${expected}`,
      validate: vi.fn().mockResolvedValue({
        success: false,
        actual: 5,
        expected: 3,
      }),
    };
    const config = await resolveConfig({
      name: "Allure Report",
      environment: "qa",
      environments: {
        qa: {
          name: "QA",
          matcher: () => true,
        },
      },
      qualityGate: {
        rules: [{ mockRule: 3 }],
        use: [mockRule],
      },
    });

    const allureReport = new AllureReport(config);
    const { results } = await allureReport.validate({
      trs: [
        {
          id: "1",
          name: "Test 1",
          status: "failed",
        } as TestResult,
      ],
      knownIssues: [],
      environment: config.environment,
    });

    expect(results).toEqual([
      expect.objectContaining({
        environment: "QA",
      }),
    ]);
    expect(mockRule.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "QA",
      }),
    );
  });

  it("should attach global attachments matched by glob patterns from working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-"));
    const first = join(cwd, "global.log");
    const second = join(cwd, "artifacts", "nested.txt");

    await writeFile(first, "first");
    await mkdir(join(cwd, "artifacts"), { recursive: true });
    await writeFile(second, "second");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["*.log", "artifacts/**/*.txt"],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => (a as unknown as Attachment).name).sort();

    expect(names).toEqual(["global.log", "nested.txt"]);
  });

  it("should deduplicate global attachments matched by multiple glob patterns", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-dedup-"));
    const file = join(cwd, "duplicated.log");

    await writeFile(file, "dup");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["*.log", "**/*.log", "duplicated.log"],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();

    expect(attachments).toHaveLength(1);
    expect((attachments[0] as unknown as Attachment)?.name).toBe("duplicated.log");
  });

  it("should ignore absolute global attachments outside working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-cwd-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "allure3-global-attachments-outside-"));
    const insideFile = join(cwd, "inside.log");
    const outsideFile = join(outsideDir, "outside.log");

    await writeFile(insideFile, "inside");
    await writeFile(outsideFile, "outside");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: [outsideFile, "*.log"],
    });

    expect(isAbsolute(outsideFile)).toBe(true);

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => (a as unknown as Attachment).name).sort();

    expect(names).toEqual(["inside.log"]);
    expect(names).not.toContain("outside.log");
  });

  it("should ignore possibly sensitive files outside working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure3-global-attachments-sensitive-cwd-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "allure3-global-attachments-sensitive-outside-"));
    const insideFile = join(cwd, "artifacts", "safe.txt");
    const sensitiveFile = join(outsideRoot, "secrets", "token.txt");

    await mkdir(join(cwd, "artifacts"), { recursive: true });
    await mkdir(join(outsideRoot, "secrets"), { recursive: true });
    await writeFile(insideFile, "safe");
    await writeFile(sensitiveFile, "super-secret");

    process.chdir(cwd);

    const config = await resolveConfig({
      name: "Allure Report",
      globalAttachments: ["**/*.txt", sensitiveFile],
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();

    const attachments = await allureReport.store.allGlobalAttachments();
    const names = attachments.map((a) => (a as unknown as Attachment).name).sort();

    expect(names).toEqual(["safe.txt"]);
    expect(names).not.toContain("token.txt");
  });

  it("should coalesce realtime updates without dropping events", { timeout: 10000 }, async () => {
    const p1 = createPlugin("p1");
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const blockUpdate = createSignal();
    const firstUpdateStarted = createSignal();
    const secondUpdateStarted = createSignal();
    config.plugins?.push(p1);

    const allureReport = new AllureReport({
      ...config,
      realTime: true,
    });

    await allureReport.start();

    (p1.plugin.update as Mock)
      .mockReset()
      .mockImplementationOnce(async () => {
        firstUpdateStarted.resolve();
        await blockUpdate.promise;
      })
      .mockImplementationOnce(async () => {
        secondUpdateStarted.resolve();
      })
      .mockResolvedValue(undefined);

    allureReport.realtimeDispatcher.sendTestResult("tr-1");
    await firstUpdateStarted.promise;

    expect(p1.plugin.update).toBeCalledTimes(1);

    allureReport.realtimeDispatcher.sendTestResult("tr-2");
    allureReport.realtimeDispatcher.sendTestResult("tr-3");
    await setTimeout(150);

    expect(p1.plugin.update).toBeCalledTimes(1);

    blockUpdate.resolve();
    await secondUpdateStarted.promise;

    expect(p1.plugin.update).toBeCalledTimes(2);
    await allureReport.done();
  });

  it("should shutdown cleanly when no realtime events occurred after start", async () => {
    const p1 = createPlugin("p1");
    const config = await resolveConfig({
      name: "Allure Report",
    });

    config.plugins?.push(p1);

    const allureReport = new AllureReport({
      ...config,
      realTime: true,
    });

    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.update).toBeCalledTimes(1);
    expect(p1.plugin.done).toBeCalledTimes(1);
  });

  it(
    "should not schedule extra updates for realtime events before scheduled update starts",
    { timeout: 10000 },
    async () => {
      const p1 = createPlugin("p1");
      const config = await resolveConfig({
        name: "Allure Report",
      });

      config.plugins?.push(p1);

      const allureReport = new AllureReport({
        ...config,
        realTime: true,
      });

      await allureReport.start();

      (p1.plugin.update as Mock).mockReset().mockResolvedValue(undefined);

      allureReport.realtimeDispatcher.sendTestResult("tr-1");
      allureReport.realtimeDispatcher.sendTestFixtureResult("tfr-1");
      allureReport.realtimeDispatcher.sendAttachmentFile("af-1");

      await allureReport.done();

      expect(p1.plugin.update).toBeCalledTimes(1);
    },
  );

  it("should wait for active realtime update before plugin done", { timeout: 10000 }, async () => {
    const p1 = createPlugin("p1");
    const config = await resolveConfig({
      name: "Allure Report",
    });

    config.plugins?.push(p1);

    const allureReport = new AllureReport({
      ...config,
      realTime: true,
    });

    await allureReport.start();

    const blockUpdate = createSignal();
    const updateStarted = createSignal();
    let doneResolved = false;

    (p1.plugin.update as Mock)
      .mockReset()
      .mockImplementationOnce(async () => {
        updateStarted.resolve();
        await blockUpdate.promise;
      })
      .mockResolvedValue(undefined);
    (p1.plugin.done as Mock).mockReset().mockResolvedValue(undefined);

    allureReport.realtimeDispatcher.sendTestResult("tr-1");
    await updateStarted.promise;

    expect(p1.plugin.update).toBeCalledTimes(1);

    const donePromise = allureReport.done().then(() => {
      doneResolved = true;
    });
    await setTimeout(100);

    expect(doneResolved).toBe(false);
    expect(p1.plugin.done).not.toBeCalled();

    blockUpdate.resolve();
    await donePromise;

    expect(p1.plugin.done).toBeCalledTimes(1);
    expect((p1.plugin.update as Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (p1.plugin.done as Mock).mock.invocationCallOrder[0],
    );
  });

  it(
    "should finish plugin done when active realtime plugin update fails during shutdown",
    { timeout: 10000 },
    async () => {
      const p1 = createPlugin("p1");
      const config = await resolveConfig({
        name: "Allure Report",
      });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const updateError = new Error("update failed");
      const releaseUpdate = createSignal();
      const updateStarted = createSignal();

      config.plugins?.push(p1);

      const allureReport = new AllureReport({
        ...config,
        realTime: true,
      });

      await allureReport.start();

      (p1.plugin.update as Mock).mockReset().mockImplementationOnce(async () => {
        updateStarted.resolve();
        await releaseUpdate.promise;
        throw updateError;
      });
      (p1.plugin.done as Mock).mockReset().mockResolvedValue(undefined);

      allureReport.realtimeDispatcher.sendTestResult("tr-1");
      await updateStarted.promise;

      const donePromise = allureReport.done();
      await setTimeout(100);

      expect(p1.plugin.done).not.toBeCalled();

      releaseUpdate.resolve();
      await donePromise;

      const pluginErrorCalls = consoleError.mock.calls.filter(([message]) => message === "plugin p1 error");

      expect(pluginErrorCalls).toHaveLength(1);
      expect(pluginErrorCalls[0][1]).toBe(updateError);
      expect(p1.plugin.done).toBeCalledTimes(1);

      consoleError.mockRestore();
    },
  );
});
