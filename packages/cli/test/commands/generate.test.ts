import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { glob } from "glob";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { GenerateCommand } from "../../src/commands/generate.js";
import { logError } from "../../src/utils/logs.js";
import { AllureReportMock } from "../utils.js";

vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    AllureReport: utils.AllureReportMock,
    readConfig: vi.fn(),
  };
});
vi.mock("../../src/utils/logs.js", () => ({
  logError: vi.fn(),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generate command", () => {
  it("should do nothing when there are no results directory and stage files", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({});

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./notfound";
    command.stage = [];

    await command.execute();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No test results directories found matching pattern: ./notfound"),
    );
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize and run allure report when the results directory is provided", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = [];

    await command.execute();

    expect(AllureReportMock).toHaveBeenCalled();

    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith([]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./allure-results/");
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
  });

  it("should handle known errors and exit with code 1 without errors logging", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    AllureReportMock.prototype.start.mockRejectedValueOnce(new KnownError("known error"));

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = [];

    const promise = command.execute();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(async () => await promise).not.toThrow();
    expect(logError).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should handle unknown errors and exit with code 1 with errors logging", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    AllureReportMock.prototype.start.mockRejectedValueOnce(new Error("unknown error"));

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = [];

    const promise = command.execute();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(async () => await promise).not.toThrow();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to generate report"), expect.any(Error));
    expect(console.error).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should restore state from stage dump files when provided via cli arguments", async () => {
    vi.mocked(glob).mockReset();

    vi.mocked(glob).mockResolvedValueOnce(["stage1.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["stage2.zip"]);
    vi.mocked(glob).mockResolvedValueOnce([]);

    (readConfig as Mock).mockResolvedValue({});

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = undefined;
    command.stage = ["stage1.zip", "stage2.zip"];

    await command.execute();

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["stage1.zip", "stage2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).not.toHaveBeenCalled();
  });

  it("should restore state from both stage dump files and results directories", async () => {
    vi.mocked(glob).mockReset();

    vi.mocked(glob).mockResolvedValueOnce(["stage1.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["stage2.zip"]);
    vi.mocked(glob).mockResolvedValueOnce(["./allure-results/"]);

    (readConfig as Mock).mockResolvedValue({});

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = ["stage1.zip", "stage2.zip"];

    await command.execute();

    expect(AllureReportMock).toHaveBeenCalled();
    expect(AllureReportMock.prototype.restoreState).toHaveBeenCalledWith(["stage1.zip", "stage2.zip"]);
    expect(AllureReportMock.prototype.start).toHaveBeenCalled();
    expect(AllureReportMock.prototype.done).toHaveBeenCalled();
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("./allure-results/");
  });
});
