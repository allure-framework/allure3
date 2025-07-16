import { AllureReport, resolveConfig, writeKnownIssues } from "@allurereport/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnownIssueCommand } from "../../src/commands/knownIssue.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  output: "./custom/output/path.json",
  cwd: ".",
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
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
  it("should initialize allure report and write known issues with custom output path", async () => {
    const command = new KnownIssueCommand();

    command.output = fixtures.output;
    command.resultsDir = [fixtures.resultsDir];

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
