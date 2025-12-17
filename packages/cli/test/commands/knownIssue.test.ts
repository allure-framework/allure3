import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { KnownIssueCommand } from "../../src/commands/knownIssue.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  output: "./custom/output/path.json",
  cwd: ".",
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    ...(await importOriginal()),
    resolveConfig: vi.fn().mockResolvedValue({}),
    writeKnownIssues: vi.fn(),
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("known-issue command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new KnownIssueCommand();

    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Given test results directory doesn't exist: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report and write known issues with default output path", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);

    const command = new KnownIssueCommand();

    command.output = undefined;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith({
      plugins: {},
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledWith(fixtures.resultsDir);
    expect(AllureReport.prototype.done).toHaveBeenCalledTimes(1);
    expect(writeKnownIssues).toHaveBeenCalledTimes(1);
  });

  it("should initialize allure report and write known issues with custom output path", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);

    const command = new KnownIssueCommand();

    command.output = fixtures.output;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith({
      plugins: {},
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledWith(fixtures.resultsDir);
    expect(AllureReport.prototype.done).toHaveBeenCalledTimes(1);
    expect(writeKnownIssues).toHaveBeenCalledTimes(1);
  });
});
