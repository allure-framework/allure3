import type { GlobalAttachmentLink } from "@allurereport/core-api";
import type { AllureStore, PluginContext, ReportFiles, ResultFile } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Allure2Plugin } from "../src/plugin.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-allure2");
  await story("index");
  await label("coverage", "plugin-allure2");
});

const presentAttachment: GlobalAttachmentLink = {
  id: "global-log",
  name: "run.log",
  originalFileName: "run.log",
  ext: ".txt",
  used: true,
  missed: false,
  contentType: "text/plain",
  contentLength: 10,
};

const missingAttachment: GlobalAttachmentLink = {
  id: "missing-log",
  name: "missing.log",
  originalFileName: "missing.log",
  ext: ".txt",
  used: true,
  missed: false,
  contentType: "text/plain",
  contentLength: 7,
};

const attachmentFile = {
  asBuffer: vi.fn().mockResolvedValue(Buffer.from("global log")),
  writeTo: vi.fn(),
  getOriginalFileName: vi.fn().mockReturnValue("run.log"),
  getExtension: vi.fn().mockReturnValue(".txt"),
  getContentType: vi.fn().mockReturnValue("text/plain"),
  getContentLength: vi.fn().mockReturnValue(10),
} as unknown as ResultFile;

const createStore = (): AllureStore =>
  ({
    allAttachments: vi.fn().mockResolvedValue([presentAttachment, missingAttachment]),
    attachmentContentById: vi.fn(async (id: string) => (id === presentAttachment.id ? attachmentFile : undefined)),
    allGlobalErrors: vi.fn().mockResolvedValue([
      {
        message: "Global setup failed",
        trace: "Error: Global setup failed",
        actual: "failed",
        expected: "passed",
      },
    ]),
    allGlobalAttachments: vi.fn().mockResolvedValue([presentAttachment, missingAttachment]),
    metadataByKey: vi.fn().mockResolvedValue(undefined),
    allTestResults: vi.fn().mockResolvedValue([]),
    relatedByTestResultIds: vi.fn().mockResolvedValue({
      attachmentsByTrId: new Map(),
      fixturesByTrId: new Map(),
      historyByTrId: new Map(),
      retriesByTrId: new Map(),
    }),
    allHistoryDataPoints: vi.fn().mockResolvedValue([]),
  }) as unknown as AllureStore;

const createContext = () => {
  const files = new Map<string, Buffer>();
  const reportFiles: ReportFiles = {
    addFile: vi.fn(async (path: string, data: Buffer) => {
      files.set(path, data);
      return path;
    }),
  };
  const context = {
    id: "allure2",
    publish: true,
    allureVersion: "3.16.0",
    reportUuid: "report-uuid",
    reportName: "Allure 2 Report",
    reportFiles,
    output: "out",
  } as PluginContext;

  return { context, files };
};

describe("Allure2Plugin", () => {
  it("should generate the Allure 2.46 UI and run-level data", async () => {
    const { context, files } = createContext();
    const plugin = new Allure2Plugin({ reportLanguage: "en" });

    await plugin.done(context, createStore());

    const mainAsset = [...files.keys()].find((name) => /^assets\/index-[\w-]+\.js$/u.test(name));

    expect(mainAsset).toBeDefined();
    expect(files.get(mainAsset!)?.toString()).toContain("data:image/x-icon;base64,");
    expect(files.get("data/attachments/global-log.txt")?.toString()).toBe("global log");

    const index = files.get("index.html")?.toString();
    expect(index).toContain('<meta name="allure-report-uuid" content="report-uuid">');
    expect(index).toContain(`src="${mainAsset}"`);
    expect(index).not.toContain("favicon.ico");
    expect(index).not.toContain("window.allureReportData");

    const globals = JSON.parse(files.get("widgets/globals.json")!.toString());
    expect(globals).toEqual({
      errors: [
        {
          message: "Global setup failed",
          trace: "Error: Global setup failed",
          actual: "failed",
          expected: "passed",
        },
      ],
      attachments: [
        {
          uid: "global-log",
          name: "run.log",
          source: "global-log.txt",
          type: "text/plain",
          size: 10,
        },
      ],
    });
  });

  it("should embed the latest UI and report data in single-file mode", async () => {
    const { context, files } = createContext();
    const plugin = new Allure2Plugin({ reportLanguage: "en", singleFile: true });

    await plugin.done(context, createStore());

    expect([...files.keys()]).toEqual(["index.html"]);

    const index = files.get("index.html")!.toString();
    expect(index).toContain("data:text/javascript;base64,");
    expect(index).toContain("window.reportData = window.reportData || {};");
    expect(index).toContain('d("widgets/globals.json"');
    expect(index).not.toContain("window.allureReportData");
  });
});
