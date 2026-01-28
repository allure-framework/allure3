import { type TestResult } from "@allurereport/core-api";
import { type AllureStore, type PluginContext, type ReportFiles } from "@allurereport/plugin-api";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CsvPlugin } from "../src/plugin.js";

vi.mock("node:fs/promises");
vi.mock("@allurereport/core-api", async (importOriginal) => {
  return {
    ...((await importOriginal()) as any),
    formatDuration: (ms: number) => `${ms}ms`,
  };
});

const mockTestResult: TestResult = {
  id: "1",
  name: "test name",
  fullName: "full test name",
  status: "passed",
  duration: 123,
  start: 1000,
  stop: 1123,
  labels: [
    { name: "parentSuite", value: "ps" },
    { name: "suite", value: "s" },
  ],
  steps: [],
} as unknown as TestResult;

describe("CsvPlugin", () => {
  let context: PluginContext;
  let store: AllureStore;
  let reportFiles: ReportFiles;
  let addFileMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    addFileMock = vi.fn();
    reportFiles = {
      addFile: addFileMock,
    } as unknown as ReportFiles;
    context = {
      reportFiles,
    } as unknown as PluginContext;
    store = {
      allTestResults: vi.fn().mockResolvedValue([mockTestResult]),
    } as unknown as AllureStore;
  });

  it("should generate csv with default options", async () => {
    const plugin = new CsvPlugin();

    await plugin.done(context, store);

    expect(addFileMock).toHaveBeenCalledWith("allure-report.csv", expect.any(Buffer));

    const buffer = addFileMock.mock.calls[0][1] as Buffer;
    const content = buffer.toString();

    expect(content).toContain("Full Name,Name,Status,Duration");
    expect(content).toContain('"full test name","test name","passed","123ms"');
  });

  it("should write to absolute path", async () => {
    const absolutePath = "/tmp/custom-report.csv";
    const plugin = new CsvPlugin({ fileName: absolutePath });

    await plugin.done(context, store);

    expect(addFileMock).not.toHaveBeenCalled();
    expect(mkdir).toHaveBeenCalledWith(dirname(absolutePath), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(absolutePath, expect.any(Buffer));

    const buffer = (writeFile as Mock).mock.calls[0][1] as Buffer;
    const content = buffer.toString();

    expect(content).toContain("Full Name,Name,Status");
  });

  it("should respect disableHeaders option", async () => {
    const plugin = new CsvPlugin({ disableHeaders: true });

    await plugin.done(context, store);

    const buffer = addFileMock.mock.calls[0][1] as Buffer;
    const content = buffer.toString();

    expect(content).not.toContain("Full Name,Name,Status");
    expect(content).toContain('"full test name","test name"');
  });

  it("should respect separator option", async () => {
    const plugin = new CsvPlugin({ separator: ";" });

    await plugin.done(context, store);

    const buffer = addFileMock.mock.calls[0][1] as Buffer;
    const content = buffer.toString();

    expect(content).toContain("Full Name;Name;Status");
    expect(content).toContain('"full test name";"test name"');
  });

  it("should respect custom fileName (relative path)", async () => {
    const plugin = new CsvPlugin({ fileName: "my-report.csv" });

    await plugin.done(context, store);

    expect(addFileMock).toHaveBeenCalledWith("my-report.csv", expect.any(Buffer));
  });

  it("should respect custom fields", async () => {
    const plugin = new CsvPlugin({
      fields: [
        { header: "ID", accessor: "id" },
        { header: "Custom Name", accessor: (t) => `custom-${t.name}` },
      ],
    });

    await plugin.done(context, store);

    const buffer = addFileMock.mock.calls[0][1] as Buffer;
    const content = buffer.toString();

    expect(content).toContain("ID,Custom Name");
    expect(content).toContain('"1","custom-test name"');
  });
});
