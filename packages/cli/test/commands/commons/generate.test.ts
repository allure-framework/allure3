import { exit } from "node:process";

import type { FullConfig } from "@allurereport/core";
import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { epic, feature, label, story } from "allure-js-commons";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { generate } from "../../../src/commands/commons/generate.js";
import { collectReportSummary } from "../../../src/commands/commons/summary.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureReportMock } from "../../utils.js";

vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async () => {
  const utils = await import("../../utils.js");

  return {
    AllureReport: utils.AllureReportMock,
    readConfig: vi.fn(),
  };
});
vi.mock("../../../src/utils/logs.js", () => ({
  logError: vi.fn(),
}));
vi.mock("../../../src/commands/commons/summary.js", () => ({
  collectReportSummary: vi.fn().mockResolvedValue({ name: "Allure Report" }),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("generate");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

describe("generate function", () => {
  it("should do nothing when there are no results directory and dump files", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({});

    await generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["./notfound"],
      dump: [],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No test results directories found matching pattern: ./notfound"),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should initialize and run allure report when the results directory is provided", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});

    await generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
    });

    expect(AllureReportMock).toHaveBeenCalled();

    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith([]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./allure-results/");
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
  });

  it("should handle known errors and exit with code 1 without errors logging", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    const fence = new Promise<void>((r) => {
      AllureReportMock.prototype.start.mockImplementationOnce(async () => {
        r();
        throw new KnownError("known error");
      });
    });

    const promise = generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
    });

    await fence;
    await Promise.resolve();

    expect(async () => await promise).not.toThrow();
    expect(logError).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
  });

  it("should handle unknown errors and exit with code 1 with errors logging", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    const fence = new Promise<void>((r) => {
      AllureReportMock.prototype.start.mockImplementationOnce(async () => {
        r();
        throw new Error("unknown error");
      });
    });

    const promise = generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
    });

    await fence;
    await Promise.resolve();
    await Promise.resolve();

    expect(async () => await promise).not.toThrow();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to generate report"), expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should restore state from state dump files when provided", async () => {
    vi.mocked(glob).mockReset();

    vi.mocked(glob).mockResolvedValueOnce(["dump1.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["dump2.zip"]);
    vi.mocked(glob).mockResolvedValueOnce([]);

    (readConfig as Mock).mockResolvedValue({});

    await generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: [""],
      dump: ["dump1.zip", "dump2.zip"],
    });

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["dump1.zip", "dump2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).not.toHaveBeenCalled();
  });

  it("should still read config.resultsDir when dumps are present", async () => {
    vi.mocked(glob).mockReset();

    vi.mocked(glob).mockResolvedValueOnce(["dump1.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["./from-config/"]);

    await generate({
      cwd: ".",
      config: { resultsDir: ["./from-config"] } as FullConfig,
      resultsDir: [],
      dump: ["dump1.zip"],
    });

    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["dump1.zip"]);
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./from-config/");
  });

  it("should restore state from both state dump files and results directories", async () => {
    vi.mocked(glob).mockReset();

    vi.mocked(glob).mockResolvedValueOnce(["dump1.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["dump2.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["./allure-results/"]);

    (readConfig as Mock).mockResolvedValue({});

    await generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["./allure-results"],
      dump: ["dump1.zip", "dump2.zip"],
    });

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["dump1.zip", "dump2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./allure-results/");
  });

  it("should collect an optional summary after ingestion and return it only after done succeeds", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    const events: string[] = [];
    AllureReportMock.prototype.readDirectory.mockImplementationOnce(async () => {
      events.push("readDirectory");
    });
    vi.mocked(collectReportSummary).mockImplementationOnce(async () => {
      events.push("summary");

      return {
        name: "CLI report",
        duration: 1,
        stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
        newTests: 1,
        flakyTests: 0,
        retryTests: 0,
      };
    });
    AllureReportMock.prototype.done.mockImplementationOnce(async () => {
      events.push("done");
    });

    const result = await generate({
      cwd: ".",
      config: { name: "CLI report" } as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
      collectSummary: true,
    });

    expect(collectReportSummary).toHaveBeenCalledWith(AllureReportMock.prototype.store, "CLI report");
    expect(result).toEqual({
      summary: {
        name: "CLI report",
        duration: 1,
        stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
        newTests: 1,
        flakyTests: 0,
        retryTests: 0,
      },
    });
    expect(events).toEqual(["readDirectory", "summary", "done"]);
  });

  it("should not collect summaries for default callers", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);

    const result = await generate({
      cwd: ".",
      config: { name: "CLI report" } as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
    });

    expect(result).toBeUndefined();
    expect(collectReportSummary).not.toHaveBeenCalled();
  });

  it("should warn and finish generation when optional summary collection fails", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    vi.mocked(collectReportSummary).mockRejectedValueOnce(new Error("summary failed"));

    const result = await generate({
      cwd: ".",
      config: { name: "CLI report" } as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
      collectSummary: true,
    });

    expect(result).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("GitLab summary snapshot skipped"));
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("should not return a summary when done fails after snapshot capture", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    vi.mocked(collectReportSummary).mockResolvedValueOnce({
      name: "CLI report",
      duration: 1,
      stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
      newTests: 1,
      flakyTests: 0,
      retryTests: 0,
    });
    AllureReportMock.prototype.done.mockRejectedValueOnce(new KnownError("done failed"));

    const result = await generate({
      cwd: ".",
      config: { name: "CLI report" } as FullConfig,
      resultsDir: ["./allure-results"],
      dump: [],
      collectSummary: true,
    });

    expect(result).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("done failed"));
    expect(exit).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
  });

  it("should support multiple result directories", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo1/", "./foo2/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar1/", "./bar2/"]);
    (readConfig as Mock).mockResolvedValue({});

    await generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: ["foo", "bar"],
      dump: [],
    });

    expect(AllureReportMock).toHaveBeenCalled();

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: ".",
    });
    expect(glob).toHaveBeenNthCalledWith(2, "bar", {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: ".",
    });
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith([]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledTimes(4);
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo1/");
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./foo2/");
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenNthCalledWith(3, "./bar1/");
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenNthCalledWith(4, "./bar2/");
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
  });
});
