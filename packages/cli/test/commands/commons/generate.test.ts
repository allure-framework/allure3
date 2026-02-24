import type { FullConfig } from "@allurereport/core";
import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { glob } from "glob";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../../src/commands/commons/generate.js";
import { logError } from "../../../src/utils/logs.js";
import { AllureReportMock } from "../../utils.js";

vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../../utils.js");

  return {
    ...(await importOriginal()),
    AllureReport: utils.AllureReportMock,
    readConfig: vi.fn(),
  };
});
vi.mock("../../../src/utils/logs.js", () => ({
  logError: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));

beforeEach(() => {
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
      resultsDir: "./notfound",
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
      resultsDir: "./allure-results",
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
    AllureReportMock.prototype.start.mockRejectedValueOnce(new KnownError("known error"));

    const promise = generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: "./allure-results",
      dump: [],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
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
    AllureReportMock.prototype.start.mockRejectedValueOnce(new Error("unknown error"));

    const promise = generate({
      cwd: ".",
      config: {} as FullConfig,
      resultsDir: "./allure-results",
      dump: [],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
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
      resultsDir: "",
      dump: ["dump1.zip", "dump2.zip"],
    });

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["dump1.zip", "dump2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).not.toHaveBeenCalled();
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
      resultsDir: "./allure-results",
      dump: ["dump1.zip", "dump2.zip"],
    });

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["dump1.zip", "dump2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./allure-results/");
  });
});
