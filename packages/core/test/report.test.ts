import console from "node:console";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";

import type { TestResult } from "@allurereport/core-api";
import type { Plugin, QualityGateRule } from "@allurereport/plugin-api";
import { BufferResultFile, type ResultsReader } from "@allurereport/reader-api";
import { generateSummary } from "@allurereport/summary";
import { attachment, epic, feature, label, step, story } from "allure-js-commons";
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
vi.mock("@allurereport/summary", () => ({
  generateSummary: vi.fn(),
}));
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

const createAbortError = () => {
  const abortError = new Error("upload aborted");

  abortError.name = "AbortError";

  return abortError;
};

const waitForAbort = (signal?: AbortSignal, onAbort?: () => void) =>
  new Promise<never>((_, reject) => {
    const rejectWithAbort = () => {
      onAbort?.();
      reject(createAbortError());
    };

    if (signal?.aborted) {
      rejectWithAbort();
    } else {
      signal?.addEventListener("abort", rejectWithAbort, { once: true });
    }
  });

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

  it("should publish reports which have publish option and marks report as complited", async () => {
    const fixtures = {
      reportUrl: "https://allurereport.com/reports",
      summaries: [
        {
          foo: "bar",
        },
        {
          bar: "baz",
        },
        {
          baz: "qux",
        },
      ],
    };
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: false });
    const p3 = createPlugin("p3", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
    });
    let allureReport!: AllureReport;

    await step("prepare published plugins and mocked service report", async () => {
      (p1.plugin.info as Mock).mockResolvedValue(fixtures.summaries[0]);
      (p2.plugin.info as Mock).mockResolvedValue(fixtures.summaries[1]);
      (p3.plugin.info as Mock).mockResolvedValue(undefined);
      (AllureServiceClientMock.prototype.createReport as Mock).mockResolvedValue(new URL(fixtures.reportUrl));

      config.plugins = [p1, p2, p3];

      await attachment(
        "remote context",
        JSON.stringify({ repo: "allure3", branch: "main", publishedPlugins: [p1.id, p3.id] }, null, 2),
        "application/json",
      );

      allureReport = new AllureReport({
        ...config,
        allureService: {
          accessToken: validAccessToken,
        },
      });
    });

    await step("generate and publish the report", async () => {
      await allureReport.start();
      await allureReport.done();
    });

    await step("verify service report metadata and summaries", async () => {
      expect(AllureServiceClientMock.prototype.createReport).toBeCalledWith({
        reportUuid: allureReport.reportUuid,
        reportName: "Allure Report",
        repo: "allure3",
        branch: "main",
      });
      expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
      expect(AllureServiceClientMock.prototype.completeReport).toBeCalledWith({
        reportUuid: allureReport.reportUuid,
        historyPoint: expect.any(Object),
      });
      expect(generateSummary).toBeCalledTimes(1);
      expect(generateSummary).toBeCalledWith(expect.any(String), [
        {
          ...fixtures.summaries[0],
          href: `${p1.id}/`,
          remoteHref: `${fixtures.reportUrl}/${p1.id}/`,
          pullRequestHref: undefined,
          jobHref: undefined,
        },
        {
          ...fixtures.summaries[1],
          href: `${p2.id}/`,
          pullRequestHref: undefined,
          jobHref: undefined,
        },
      ]);
    });
  });

  it("should retry transient upload failures and publish without deleting remote report", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-upload-retry-success-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const attemptsByFilename: Record<string, number> = {};

    addReportFileMock.mockReset();
    addReportAssetMock.mockReset();
    deleteReportMock.mockReset();
    addReportAssetMock.mockResolvedValue({});
    deleteReportMock.mockResolvedValue({});

    await step("prepare a published plugin with a transiently failing file", async () => {
      (p1.plugin.done as Mock).mockImplementation(async (context) => {
        await context.reportFiles.addFile("index.html", Buffer.from("index"));
        await context.reportFiles.addFile("data/retry.json", Buffer.from("{}"));
      });
      (p1.plugin.info as Mock).mockResolvedValue(undefined);
      addReportFileMock.mockImplementation((payload: { filename: string }) => {
        attemptsByFilename[payload.filename] = (attemptsByFilename[payload.filename] ?? 0) + 1;

        if (payload.filename === "data/retry.json" && attemptsByFilename[payload.filename] < 3) {
          return Promise.reject(new Error("transient upload failure"));
        }

        return Promise.resolve(`https://allurereport.com/reports/${p1.id}/${payload.filename}`);
      });
      config.plugins = [p1];
    });

    const allureReport = new AllureReport({
      ...config,
      allureService: {
        accessToken: validAccessToken,
      },
    });

    await allureReport.start();
    await allureReport.done();

    await step("verify transient failure was retried without remote cleanup", async () => {
      await attachment("upload attempts", JSON.stringify(attemptsByFilename, null, 2), "application/json");

      expect(attemptsByFilename["data/retry.json"]).toBe(3);
      expect(attemptsByFilename["index.html"]).toBe(1);
      expect(deleteReportMock).not.toBeCalled();
      expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
    });
  });

  it("should delete remote plugin report after 5 failed upload attempts for a single file", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-upload-retry-fail-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    addReportFileMock.mockReset();
    addReportAssetMock.mockReset();
    deleteReportMock.mockReset();
    addReportFileMock.mockRejectedValue(new Error("upload failed"));
    addReportAssetMock.mockResolvedValue({});
    deleteReportMock.mockResolvedValue({});

    try {
      (p1.plugin.done as Mock).mockImplementation(async (context) => {
        await context.reportFiles.addFile("data/failing.json", Buffer.from("{}"));
      });
      (p1.plugin.info as Mock).mockResolvedValue(undefined);
      config.plugins = [p1];

      const allureReport = new AllureReport({
        ...config,
        allureService: {
          accessToken: validAccessToken,
        },
      });

      await allureReport.start();
      await allureReport.done();

      expect(addReportFileMock).toBeCalledTimes(5);
      expect(deleteReportMock).toBeCalledTimes(1);
      expect(deleteReportMock).toBeCalledWith({
        reportUuid: allureReport.reportUuid,
        pluginId: p1.id,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
      expect(consoleInfo).not.toBeCalledWith("Next reports have been published:");
    } finally {
      consoleError.mockRestore();
      consoleInfo.mockRestore();
    }
  });

  it("should not complete remote report when failed plugin cleanup fails", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-upload-cleanup-fail-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const p2 = createPlugin("p2", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    addReportFileMock.mockReset();
    addReportAssetMock.mockReset();
    deleteReportMock.mockReset();
    addReportAssetMock.mockResolvedValue({});
    deleteReportMock.mockRejectedValue(new Error("cleanup failed"));

    try {
      (p1.plugin.done as Mock).mockImplementation(async (context) => {
        await context.reportFiles.addFile("data/failing.json", Buffer.from("{}"));
      });
      (p1.plugin.info as Mock).mockResolvedValue(undefined);
      (p2.plugin.done as Mock).mockImplementation(async (context) => {
        await context.reportFiles.addFile("index.html", Buffer.from("index"));
      });
      (p2.plugin.info as Mock).mockResolvedValue(undefined);
      addReportFileMock.mockImplementation((payload: { pluginId?: string; filename: string }) => {
        if (payload.pluginId === p1.id) {
          return Promise.reject(new Error("upload failed"));
        }

        return Promise.resolve(`https://allurereport.com/reports/${payload.pluginId}/${payload.filename}`);
      });
      config.plugins = [p1, p2];

      const allureReport = new AllureReport({
        ...config,
        allureService: {
          accessToken: validAccessToken,
        },
      });

      await allureReport.start();
      await allureReport.done();

      expect(addReportFileMock.mock.calls.filter(([payload]) => payload.pluginId === p1.id)).toHaveLength(5);
      expect(addReportFileMock.mock.calls.filter(([payload]) => payload.pluginId === p2.id)).toHaveLength(1);
      expect(deleteReportMock).toBeCalledTimes(1);
      expect(deleteReportMock).toBeCalledWith({
        reportUuid: allureReport.reportUuid,
        pluginId: p1.id,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should delete remote plugin report when more than 5 distinct uploads fail concurrently", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-upload-retry-concurrent-fail-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const firstAttemptRejectors: Record<string, (reason: unknown) => void> = {};
    const attemptsByFilename: Record<string, number> = {};
    const failingFiles = Array.from({ length: 6 }, (_, index) => `data/failing-${index}.json`);

    addReportFileMock.mockReset();
    addReportAssetMock.mockReset();
    deleteReportMock.mockReset();
    addReportAssetMock.mockResolvedValue({});
    deleteReportMock.mockResolvedValue({});

    try {
      await step("prepare six concurrently failing report files", async () => {
        await attachment("failing files", JSON.stringify(failingFiles, null, 2), "application/json");
        (p1.plugin.done as Mock).mockImplementation(async (context) => {
          for (const filename of failingFiles) {
            await context.reportFiles.addFile(filename, Buffer.from("{}"));
          }
        });
        (p1.plugin.info as Mock).mockResolvedValue(undefined);
        addReportFileMock.mockImplementation((payload: { filename: string; signal?: AbortSignal }) => {
          attemptsByFilename[payload.filename] = (attemptsByFilename[payload.filename] ?? 0) + 1;

          if (attemptsByFilename[payload.filename] === 1) {
            return new Promise<never>((_, reject) => {
              firstAttemptRejectors[payload.filename] = reject;
            });
          }

          return waitForAbort(payload.signal);
        });
        config.plugins = [p1];
      });

      const allureReport = new AllureReport({
        ...config,
        allureService: {
          accessToken: validAccessToken,
        },
      });

      await allureReport.start();

      const donePromise = allureReport.done();

      await vi.waitFor(() => {
        expect(Object.keys(firstAttemptRejectors)).toHaveLength(6);
      });
      Object.values(firstAttemptRejectors).forEach((reject) => reject(new Error("upload failed")));

      await donePromise;

      await attachment("upload attempts", JSON.stringify(attemptsByFilename, null, 2), "application/json");
      expect(deleteReportMock).toBeCalledTimes(1);
      expect(deleteReportMock).toBeCalledWith({
        reportUuid: allureReport.reportUuid,
        pluginId: p1.id,
      });
      expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("should abort pending plugin uploads before deleting a failed remote report after retry exhaustion", async () => {
    const output = await mkdtemp(join(tmpdir(), "allure3-upload-cancel-"));
    const p1 = createPlugin("p1", true, { publish: true });
    const config = await resolveConfig({
      name: "Allure Report",
      output,
    });
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const events: string[] = [];
    const uploadSignals: (AbortSignal | undefined)[] = [];
    const attemptsByFilename: Record<string, number> = {};
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    addReportFileMock.mockReset();
    addReportAssetMock.mockReset();
    deleteReportMock.mockReset();

    try {
      let allureReport!: AllureReport;

      await step("prepare a published plugin with one permanently failing upload and pending uploads", async () => {
        const pluginFiles = ["index.html", "data/failing.json", "widgets/pending.json", "assets/app.css"];

        await attachment("plugin files", JSON.stringify(pluginFiles, null, 2), "application/json");
        (p1.plugin.done as Mock).mockImplementation(async (context) => {
          await context.reportFiles.addFile("index.html", Buffer.from("index"));
          await context.reportFiles.addFile("data/failing.json", Buffer.from("{}"));
          await context.reportFiles.addFile("widgets/pending.json", Buffer.from("{}"));
          await context.reportFiles.addFile("assets/app.css", Buffer.from("body {}"));
        });
        (p1.plugin.info as Mock).mockResolvedValue(undefined);
        addReportFileMock.mockImplementation((payload: { filename: string; signal?: AbortSignal }) => {
          events.push(`upload:${payload.filename}`);
          uploadSignals.push(payload.signal);

          if (payload.filename === "data/failing.json") {
            attemptsByFilename[payload.filename] = (attemptsByFilename[payload.filename] ?? 0) + 1;

            return Promise.reject(new Error("upload failed"));
          }

          return waitForAbort(payload.signal, () => events.push(`abort:${payload.filename}`));
        });
        addReportAssetMock.mockImplementation((payload: { filename: string; signal?: AbortSignal }) => {
          events.push(`upload:${payload.filename}`);
          uploadSignals.push(payload.signal);

          return waitForAbort(payload.signal, () => events.push(`abort:${payload.filename}`));
        });
        deleteReportMock.mockImplementation(async () => {
          events.push("delete");

          return {};
        });

        config.plugins = [p1];

        allureReport = new AllureReport({
          ...config,
          allureService: {
            accessToken: validAccessToken,
          },
        });

        await allureReport.start();
      });

      await step("exhaust retries while other upload requests are still pending", async () => {
        const donePromise = allureReport.done();

        await vi.waitFor(() => {
          expect(attemptsByFilename["data/failing.json"]).toBe(5);
          expect(addReportAssetMock).toBeCalledTimes(1);
        });
        await attachment("started uploads", JSON.stringify(events, null, 2), "application/json");

        await donePromise;
      });

      await step("verify pending uploads were aborted before remote cleanup", async () => {
        const deleteIndex = events.indexOf("delete");

        await attachment(
          "upload cancellation events",
          JSON.stringify(
            {
              events,
              signalCount: uploadSignals.length,
              uniqueSignalCount: new Set(uploadSignals).size,
              signalStates: uploadSignals.map((signal) => ({ aborted: signal?.aborted })),
            },
            null,
            2,
          ),
          "application/json",
        );

        expect(deleteIndex).toBeGreaterThan(-1);
        expect(new Set(uploadSignals).size).toBe(1);
        expect(uploadSignals.every((signal) => signal?.aborted)).toBe(true);

        for (const filename of ["index.html", "widgets/pending.json", "assets/app.css"]) {
          const abortIndex = events.indexOf(`abort:${filename}`);

          expect(abortIndex).toBeGreaterThan(-1);
          expect(abortIndex).toBeLessThan(deleteIndex);
        }
        expect(deleteReportMock).toBeCalledTimes(1);
        expect(deleteReportMock).toBeCalledWith({
          reportUuid: allureReport.reportUuid,
          pluginId: p1.id,
        });
        expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
        expect(consoleInfo).not.toBeCalledWith("Next reports have been published:");
      });
    } finally {
      consoleError.mockRestore();
      consoleInfo.mockRestore();
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
