import * as console from "node:console";
import { exit } from "node:process";

import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import { run } from "clipanion";
import { glob } from "glob";
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
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    resolveConfig: vi.fn().mockResolvedValue({}),
    writeKnownIssues: vi.fn(),
    AllureReport: AllureReportMock,
  };
});
vi.mock("glob", async () => {
  return {
    glob: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("known-issue command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(KnownIssueCommand, ["known-issue", fixtures.resultsDir]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`No test results directories found matching pattern: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report and write known issues with default output path", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(KnownIssueCommand, ["known-issue", fixtures.resultsDir]);

    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith({
      plugins: {},
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledWith(`${fixtures.resultsDir}/`);
    expect(AllureReport.prototype.done).toHaveBeenCalledTimes(1);
    expect(writeKnownIssues).toHaveBeenCalledTimes(1);
  });

  it("should initialize allure report and write known issues with custom output path", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(KnownIssueCommand, ["known-issue", "--output", fixtures.output, fixtures.resultsDir]);

    expect(resolveConfig).toHaveBeenCalledTimes(1);
    expect(resolveConfig).toHaveBeenCalledWith({
      plugins: {},
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledWith(`${fixtures.resultsDir}/`);
    expect(AllureReport.prototype.done).toHaveBeenCalledTimes(1);
    expect(writeKnownIssues).toHaveBeenCalledTimes(1);
  });

  it("should support multiple resultsDir", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar/"]);

    await run(KnownIssueCommand, ["known-issue", "foo", "bar"]);

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", expect.any(Object));
    expect(glob).toHaveBeenNthCalledWith(2, "bar", expect.any(Object));

    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(2);
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo/");
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./bar/");
  });
});
