import console from "node:console";

import type { PluginContext, PluginPublishContext } from "@allurereport/plugin-api";
import { type Mock, type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StoragePlugin } from "../src/plugin.js";

const validAccessToken =
  "ars1.eyJhY2Nlc3NUb2tlbiI6IkVMekZoOFZvaENXeXRrTFlGZ0U2QzVtTS1DWTlyWnd2ZXVYMkRlbmtkTm8iLCJ1cmwiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAifQ.OEwujL5WsTP0TQ8nFxrUauKfRLslw-S2ZFnlgFPTwO8";

const { AllureServiceClientMock } = vi.hoisted(() => ({
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
  AllureServiceClientMock: vi.fn(function () {}),
}));

AllureServiceClientMock.prototype.createReport = vi.fn();
AllureServiceClientMock.prototype.completeReport = vi.fn();
AllureServiceClientMock.prototype.deleteReport = vi.fn();
AllureServiceClientMock.prototype.addReportAsset = vi.fn();
AllureServiceClientMock.prototype.addReportFile = vi.fn();

vi.mock("@allurereport/service", () => ({
  AllureServiceClient: AllureServiceClientMock,
}));
vi.mock("@allurereport/summary", () => ({
  generateSummary: vi.fn(),
}));

const createPublishContext = (): PluginPublishContext => ({
  reportUuid: "uuid-1",
  reportName: "Report",
  historyPoint: { uid: "h-1" } as any,
  reports: [],
});

describe("storage plugin", () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (AllureServiceClientMock.prototype.createReport as Mock).mockResolvedValue(new URL("https://remote/report"));
    (AllureServiceClientMock.prototype.addReportFile as Mock).mockResolvedValue("https://remote/report/p/index.html");
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("creates report on start and sets reportUrl", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = {
      publish: true,
      reportUuid: "uuid-1",
      reportName: "Report",
      ci: { repoName: "repo", jobRunBranch: "main" },
    } as PluginContext;

    await plugin.start(context);

    expect(AllureServiceClientMock.prototype.createReport).toBeCalledWith({
      reportUuid: "uuid-1",
      reportName: "Report",
      repo: "repo",
      branch: "main",
    });
    expect(context.reportUrl).toEqual("https://remote/report");
  });

  it("does not create report on start in realtime mode", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = {
      publish: true,
      realTime: true,
      reportUuid: "uuid-1",
      reportName: "Report",
    } as PluginContext;

    await plugin.start(context);

    expect(AllureServiceClientMock.prototype.createReport).not.toBeCalled();
    expect(context.reportUrl).toBeUndefined();
  });

  it("uploads report files and completes report", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [
      {
        pluginId: "a",
        publish: true,
        files: { "index.html": "/tmp/index.html", "app.js": "/tmp/app.js" },
      },
    ];

    const result = await plugin.publish(context);

    expect(AllureServiceClientMock.prototype.createReport).toBeCalledTimes(1);
    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledWith(
      expect.objectContaining({ pluginId: "a", filename: "index.html" }),
    );
    expect(AllureServiceClientMock.prototype.addReportAsset).toBeCalledWith(
      expect.objectContaining({ filename: "app.js" }),
    );
    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
    expect(result?.linksByPluginId.a).toBeTruthy();
  });

  it("reuses report created on start when publishing", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const startContext = {
      publish: true,
      reportUuid: "uuid-1",
      reportName: "Report",
    } as PluginContext;
    const publishContext = createPublishContext();

    publishContext.reports = [{ pluginId: "a", publish: true, files: { "index.html": "/tmp/index.html" } }];

    await plugin.start(startContext);
    await plugin.publish(publishContext);

    expect(AllureServiceClientMock.prototype.createReport).toBeCalledTimes(1);
  });

  it("aborts/delete and does not complete on failed upload", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [{ pluginId: "a", publish: true, files: { "index.html": "/tmp/index.html" } }];
    (AllureServiceClientMock.prototype.addReportFile as Mock).mockRejectedValue(new Error("boom"));

    const result = await plugin.publish(context);

    expect(result).toBeUndefined();
    expect(AllureServiceClientMock.prototype.deleteReport).toBeCalledWith({ reportUuid: "uuid-1", pluginId: "a" });
    expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
  });

  it("retries transient upload failure and completes without deleting report", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [{ pluginId: "a", publish: true, files: { "index.html": "/tmp/index.html" } }];
    (AllureServiceClientMock.prototype.addReportFile as Mock)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("https://remote/report/a/index.html");

    const result = await plugin.publish(context);

    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledTimes(2);
    expect(AllureServiceClientMock.prototype.deleteReport).not.toBeCalled();
    expect(AllureServiceClientMock.prototype.completeReport).toBeCalledTimes(1);
    expect(result?.linksByPluginId.a).toBe("https://remote/report/a/index.html");
  });

  it("retries permanent upload failure five times then deletes and does not complete", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [{ pluginId: "a", publish: true, files: { "index.html": "/tmp/index.html" } }];
    (AllureServiceClientMock.prototype.addReportFile as Mock).mockRejectedValue(new Error("boom"));

    const result = await plugin.publish(context);

    expect(result).toBeUndefined();
    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledTimes(5);
    expect(AllureServiceClientMock.prototype.deleteReport).toBeCalledWith({ reportUuid: "uuid-1", pluginId: "a" });
    expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
  });

  it("aborts pending plugin uploads before deleting failed remote report", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();
    const addReportFileMock = AllureServiceClientMock.prototype.addReportFile as Mock;
    const addReportAssetMock = AllureServiceClientMock.prototype.addReportAsset as Mock;
    const deleteReportMock = AllureServiceClientMock.prototype.deleteReport as Mock;
    const events: string[] = [];
    const uploadSignals: (AbortSignal | undefined)[] = [];
    let rejectFailedUpload!: (reason: unknown) => void;
    const failedUpload = new Promise<never>((_, reject) => {
      rejectFailedUpload = reject;
    });
    const waitForAbort = (filename: string, signal?: AbortSignal) =>
      new Promise<never>((_, reject) => {
        const abortError = new Error("upload aborted");

        abortError.name = "AbortError";

        if (signal?.aborted) {
          events.push(`abort:${filename}`);
          reject(abortError);
        } else if (signal) {
          signal.addEventListener(
            "abort",
            () => {
              events.push(`abort:${filename}`);
              reject(abortError);
            },
            { once: true },
          );
        }
      });
    context.reports = [
      {
        pluginId: "a",
        publish: true,
        files: {
          "index.html": "/tmp/index.html",
          "data/failing.json": "/tmp/failing.json",
          "widgets/pending.json": "/tmp/pending.json",
          "assets/app.css": "/tmp/app.css",
        },
      },
    ];
    addReportFileMock.mockImplementation((payload: { filename: string; signal?: AbortSignal }) => {
      events.push(`upload:${payload.filename}`);
      uploadSignals.push(payload.signal);

      if (payload.filename === "data/failing.json") {
        return failedUpload;
      }

      return waitForAbort(payload.filename, payload.signal);
    });
    addReportAssetMock.mockImplementation((payload: { filename: string; signal?: AbortSignal }) => {
      events.push(`upload:${payload.filename}`);
      uploadSignals.push(payload.signal);

      return waitForAbort(payload.filename, payload.signal);
    });
    deleteReportMock.mockImplementation(async () => {
      events.push("delete");

      return {};
    });

    const publishPromise = plugin.publish(context);

    await vi.waitFor(() => {
      expect(addReportFileMock).toBeCalledTimes(3);
      expect(addReportAssetMock).toBeCalledTimes(1);
    });

    rejectFailedUpload(new Error("upload failed"));
    await publishPromise;

    const deleteIndex = events.indexOf("delete");

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(new Set(uploadSignals).size).toBe(1);
    expect(uploadSignals.every((signal) => signal?.aborted)).toBe(true);

    for (const filename of ["index.html", "widgets/pending.json", "assets/app.css"]) {
      const abortIndex = events.indexOf(`abort:${filename}`);

      expect(abortIndex).toBeGreaterThan(-1);
      expect(abortIndex).toBeLessThan(deleteIndex);
    }
    expect(addReportFileMock.mock.calls.filter(([payload]) => payload.filename === "data/failing.json").length).toBe(5);
    expect(deleteReportMock).toBeCalledWith({ reportUuid: "uuid-1", pluginId: "a" });
    expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
  });

  it("does not complete when plugin fails after index upload", async () => {
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [
      { pluginId: "a", publish: true, files: { "index.html": "/tmp/index.html", "widgets/x": "/tmp/x" } },
    ];
    (AllureServiceClientMock.prototype.addReportFile as Mock)
      .mockResolvedValueOnce("https://remote/report/a/index.html")
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"));

    await plugin.publish(context);

    expect(AllureServiceClientMock.prototype.deleteReport).toBeCalledWith({ reportUuid: "uuid-1", pluginId: "a" });
    expect(AllureServiceClientMock.prototype.completeReport).not.toBeCalled();
  });

  it("uploads root summary and can regenerate filtered summary", async () => {
    const { generateSummary } = await import("@allurereport/summary");
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [
      { pluginId: "a", publish: true, files: { "index.html": "/tmp/a-index.html", "widgets/x": "/tmp/x" } },
      { pluginId: "b", publish: true, files: { "index.html": "/tmp/b-index.html" } },
      { pluginId: "c", publish: true, files: { "index.html": "/tmp/c-index.html" } },
    ];
    context.summary = {
      filepath: "/tmp/summary.html",
      summaries: [{ pluginId: "a" } as any, { pluginId: "b" } as any, { pluginId: "c" } as any],
    };

    (AllureServiceClientMock.prototype.addReportFile as Mock)
      .mockResolvedValueOnce("https://remote/report/a/index.html")
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("https://remote/report/b/index.html")
      .mockResolvedValueOnce("https://remote/report/c/index.html")
      .mockResolvedValueOnce("https://remote/report/index.html");
    (generateSummary as Mock).mockResolvedValue("/tmp/rebuilt-summary.html");

    const result = await plugin.publish(context);

    expect(generateSummary).toBeCalledTimes(1);
    expect(generateSummary).toBeCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ pluginId: "b", remoteHref: "https://remote/report/b/index.html" }),
        expect.objectContaining({ pluginId: "c", remoteHref: "https://remote/report/c/index.html" }),
      ]),
    );
    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledWith(
      expect.objectContaining({ filename: "index.html", filepath: "/tmp/rebuilt-summary.html" }),
    );
    expect(result?.remoteHref).toEqual("https://remote/report/index.html");
  });

  it("regenerates root summary with uploaded plugin links", async () => {
    const { generateSummary } = await import("@allurereport/summary");
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [
      { pluginId: "a", publish: true, files: { "index.html": "/tmp/a-index.html" } },
      { pluginId: "b", publish: true, files: { "index.html": "/tmp/b-index.html" } },
    ];
    context.summary = {
      filepath: "/tmp/summary.html",
      summaries: [{ pluginId: "a" } as any, { pluginId: "b" } as any],
    };

    (AllureServiceClientMock.prototype.addReportFile as Mock)
      .mockResolvedValueOnce("https://remote/report/a/index.html")
      .mockResolvedValueOnce("https://remote/report/b/index.html")
      .mockResolvedValueOnce("https://remote/report/index.html");
    (generateSummary as Mock).mockResolvedValue("/tmp/rebuilt-summary.html");

    const result = await plugin.publish(context);

    expect(generateSummary).toBeCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ pluginId: "a", remoteHref: "https://remote/report/a/index.html" }),
        expect.objectContaining({ pluginId: "b", remoteHref: "https://remote/report/b/index.html" }),
      ]),
    );
    expect(AllureServiceClientMock.prototype.addReportFile).toBeCalledWith(
      expect.objectContaining({ filename: "index.html", filepath: "/tmp/rebuilt-summary.html" }),
    );
    expect(result?.remoteHref).toEqual("https://remote/report/index.html");
  });

  it("skips root summary upload after cancellation when summary data is unavailable", async () => {
    const { generateSummary } = await import("@allurereport/summary");
    const plugin = new StoragePlugin({ accessToken: validAccessToken, publish: true });
    const context = createPublishContext();

    context.reports = [
      { pluginId: "a", publish: true, files: { "index.html": "/tmp/a-index.html", "widgets/x": "/tmp/x" } },
      { pluginId: "b", publish: true, files: { "index.html": "/tmp/b-index.html" } },
      { pluginId: "c", publish: true, files: { "index.html": "/tmp/c-index.html" } },
    ];
    context.summary = {
      filepath: "/tmp/summary.html",
    };

    (AllureServiceClientMock.prototype.addReportFile as Mock)
      .mockResolvedValueOnce("https://remote/report/a/index.html")
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("https://remote/report/b/index.html")
      .mockResolvedValueOnce("https://remote/report/c/index.html");

    await plugin.publish(context);

    const rootSummaryCalls = (AllureServiceClientMock.prototype.addReportFile as Mock).mock.calls.filter(
      ([payload]) => payload.filename === "index.html" && payload.filepath === "/tmp/summary.html" && !payload.pluginId,
    );

    expect(generateSummary).not.toBeCalled();
    expect(rootSummaryCalls).toHaveLength(0);
  });
});
