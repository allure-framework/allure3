import console from "node:console";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";

import type { TestResult } from "@allurereport/core-api";
import type { Plugin, QualityGateRule } from "@allurereport/plugin-api";
import { BufferResultFile, type ResultsReader } from "@allurereport/reader-api";
import { epic, feature, label, step, story } from "allure-js-commons";
import { KnownError } from "@allurereport/service";
import type { Mock, Mocked } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveConfig } from "../src/index.js";
import { AllureReport } from "../src/report.js";
import { AllureServiceClientMock } from "./utils.js";

// Token payload: { "accessToken": "ELzFh8...", "url": "http://localhost:3000" }
const validAccessToken =
  "ars1.eyJhY2Nlc3NUb2tlbiI6IkVMekZoOFZvaENXeXRrTFlGZ0U2QzVtTS1DWTlyWnd2ZXVYMkRlbmtkTm8iLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAifQ.OEwujL5WsTP0TQ8nFxrUauKfRLslw-S2ZFnlgFPTwO8";

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

const createPlugin = (id: string, enabled: boolean = true, options: Record<string, any> = {}) => {
  const plugin: Mocked<Required<Plugin>> = {
    start: vi.fn<Required<Plugin>["start"]>(),
    update: vi.fn<Required<Plugin>["update"]>(),
    done: vi.fn<Required<Plugin>["done"]>(),
    info: vi.fn<Required<Plugin>["info"]>(),
    publish: vi.fn<Required<Plugin>["publish"]>(),
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
});

afterEach(() => {
  process.chdir(previousCwd);
});

describe("report", () => {
  it("should not fail with the empty report", async () => {
    const config = await resolveConfig({
      name: "Allure Report",
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();
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

  it("should call plugin publish hook only for plugins with options.publish", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: false });
    const p3 = createPlugin("p3", true);
    const config = await resolveConfig({
      name: "Allure Report",
    });

    config.plugins = [p1, p2, p3];

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.publish).toBeCalledTimes(1);
    expect(p2.plugin.publish).toBeCalledTimes(0);
    expect(p3.plugin.publish).toBeCalledTimes(0);
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
      allureService: {
        accessToken: validAccessToken,
      },
    });

    await allureReport.start();
    await allureReport.done();

    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(0);
    expect(AllureServiceClientMock.prototype.createReport).toBeCalledTimes(0);
    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledTimes(0);
    expect(p1.plugin.publish).toBeCalledTimes(0);
    await expect(allureReport.publish()).resolves.toBeUndefined();
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

    expect(p1.plugin.publish).not.toBeCalled();
    expect(p1Summary.name).toEqual("Plugin summary");
  });

  it("should keep publish idempotent", async () => {
    const pluginPublishResult = {
      linksByPluginId: {
        p1: "https://example.org/p1",
      },
      remoteHref: "https://example.org/p1",
    };
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
    });

    (p1.plugin.publish as Mock).mockResolvedValue(pluginPublishResult);
    config.plugins = [p1];

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    const firstPublishResult = await allureReport.publish();
    const secondPublishResult = await allureReport.publish();

    expect(p1.plugin.publish).toBeCalledTimes(1);
    expect(firstPublishResult).toEqual(pluginPublishResult);
    expect(secondPublishResult).toEqual(pluginPublishResult);
  });

  it("should expose publish links in summary context for subsequent publish hooks", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-publish-summary-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report", output });
    const summary = {
      name: "Plugin summary",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed" as const,
      duration: 0,
      meta: {
        marker: "original",
      },
    };
    let observedP1RemoteHref: string | undefined;

    config.plugins = [p1, p2];
    (p1.plugin.start as Mock).mockImplementation(async (context) => {
      context.reportUrl = "https://storage.example.org/report";
    });
    (p1.plugin.info as Mock).mockResolvedValue(summary);
    (p2.plugin.info as Mock).mockResolvedValue(summary);
    (p1.plugin.publish as Mock).mockResolvedValue({
      linksByPluginId: {
        p1: "https://example.org/p1",
      },
    });
    (p2.plugin.publish as Mock).mockImplementation(async (context) => {
      const p1Summary = context.summary?.summaries.find(({ pluginId }) => pluginId === "p1");

      observedP1RemoteHref = p1Summary?.remoteHref;

      return undefined;
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.publish).toBeCalledTimes(1);
    expect(p2.plugin.publish).toBeCalledTimes(1);
    expect(observedP1RemoteHref).toEqual("https://example.org/p1");

    const p1Summary = JSON.parse(await readFile(join(output, "p1", "summary.json"), "utf8"));

    expect(p1Summary.remoteHref).toEqual("https://example.org/p1");
  });

  it("should not expose summary mutations from publish hooks without publish result links", async () => {
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: true });
    const config = await resolveConfig({ name: "Allure Report" });
    const summary = {
      name: "Plugin summary",
      stats: { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      status: "passed" as const,
      duration: 0,
      meta: {
        marker: "original",
      },
    };
    let observedRemoteHref: string | undefined;
    let observedTotal: number | undefined;
    let observedMarker: string | undefined;

    config.plugins = [p1, p2];
    (p1.plugin.info as Mock).mockResolvedValue(summary);
    (p2.plugin.info as Mock).mockResolvedValue(summary);
    (p1.plugin.publish as Mock).mockImplementation(async (context) => {
      const p1Summary = context.summary?.summaries.find(({ pluginId }) => pluginId === "p1");

      if (p1Summary) {
        p1Summary.remoteHref = "https://stale.example.org/p1";
        p1Summary.stats.total = 99;
        p1Summary.meta!.marker = "mutated";
      }

      return undefined;
    });
    (p2.plugin.publish as Mock).mockImplementation(async (context) => {
      const p1Summary = context.summary?.summaries.find(({ pluginId }) => pluginId === "p1");

      observedRemoteHref = p1Summary?.remoteHref;
      observedTotal = p1Summary?.stats.total;
      observedMarker = p1Summary?.meta?.marker;

      return undefined;
    });

    const allureReport = new AllureReport(config);

    await allureReport.start();
    await allureReport.done();

    expect(p1.plugin.publish).toBeCalledTimes(1);
    expect(p2.plugin.publish).toBeCalledTimes(1);
    expect(observedRemoteHref).toBeUndefined();
    expect(observedTotal).toBe(0);
    expect(observedMarker).toBe("original");
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
    (p1.plugin.publish as Mock).mockRejectedValue(publishError);

    const allureReport = new AllureReport(config);

    try {
      await allureReport.start();
      await allureReport.done();
      expect(consoleError).toHaveBeenCalledWith('Plugin "p1" publish has failed');
      expect(consoleError).toHaveBeenCalledWith(publishError.message);
      expect(consoleError).not.toHaveBeenCalledWith(publishError);
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
    const names = attachments.map((a) => a.name).sort();

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
    expect(attachments[0]?.name).toBe("duplicated.log");
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
    const names = attachments.map((a) => a.name).sort();

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
    const names = attachments.map((a) => a.name).sort();

    expect(names).toEqual(["safe.txt"]);
    expect(names).not.toContain("token.txt");
  });

  it("should coalesce realtime updates without dropping events", async () => {
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

  it("should not schedule extra updates for realtime events before scheduled update starts", async () => {
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
  });

  it("should wait for active realtime update before plugin done", async () => {
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

  it("should finish plugin done when active realtime plugin update fails during shutdown", async () => {
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
  });
});
