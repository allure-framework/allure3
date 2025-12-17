import { readConfig, stringifyQualityGateResults } from "@allurereport/core";
import { run } from "clipanion";
import { glob } from "glob";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { QualityGateCommand } from "../../src/commands/qualityGate.js";
import { AllureReportMock } from "../utils.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  config: "./custom/allurerc.mjs",
  cwd: ".",
  qualityGateConfig: {
    rules: [
      {
        maxFailures: 0,
      },
    ],
  },
  qualityGateValidationResults: [
    {
      success: false,
      rule: "maxFailures",
      message: "Max failures exceeded: 0 < 1",
      actual: 0,
      expected: 1,
    },
  ],
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  realpath: vi.fn().mockResolvedValue(""),
}));
vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
    stringifyQualityGateResults: vi.fn(),
    AllureReport: utils.AllureReportMock,
  };
});

const originalAllureReportMockPrototype = AllureReportMock.prototype;

beforeEach(() => {
  AllureReportMock.prototype = { ...originalAllureReportMockPrototype };
  vi.clearAllMocks();
});

describe("quality-gate command", () => {
  it("should exit with code 0 when there are no quality gate violations", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: () => {},
    };
    AllureReportMock.prototype.store = {
      allTestResults: vi.fn().mockResolvedValue([]),
      allKnownIssues: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(),
    };
    (AllureReportMock.prototype.validate as unknown as Mock).mockResolvedValueOnce({ results: [] });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exit with code 1 on fast-fail during realtime validation", async () => {
    let onTestResultsCb: (ids: string[]) => void;

    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: (cb: (ids: string[]) => void) => {
        onTestResultsCb = cb;
      },
    };
    AllureReportMock.prototype.store = {
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn().mockResolvedValue({}),
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    (stringifyQualityGateResults as Mock).mockReturnValue("quality gate failed");

    const validateMock = AllureReportMock.prototype.validate as unknown as Mock;

    validateMock.mockResolvedValueOnce({ results: [{ success: false }], fastFailed: true });
    validateMock.mockResolvedValueOnce({ results: [{ success: false }] });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    const commandPromise = command.execute();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    onTestResultsCb!(["id-1"]);

    await commandPromise;

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should use recursive discovery when resultsDir is not provided", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce(["dir1/allure-results/", "dir2/allure-results/"]);
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: () => {},
    };
    AllureReportMock.prototype.store = {
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(),
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    (AllureReportMock.prototype.validate as unknown as Mock).mockResolvedValueOnce({ results: [] });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined;

    await command.execute();

    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("dir1/allure-results/");
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("dir2/allure-results/");
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exit with code 1 and print a message when no results directories found", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    (AllureReportMock.prototype.validate as unknown as Mock).mockResolvedValueOnce({ results: [] });
    AllureReportMock.prototype.hasQualityGate = true;

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No test results directories found matching pattern:"),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should exit with code -1 when quality gate is not configured", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.store = {
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    AllureReportMock.prototype.hasQualityGate = false;

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;
    command.maxFailures = undefined;
    command.minTestsCount = undefined;
    command.successRate = undefined;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(-1);
  });

  it("should exit with code 1 when there is no test results found", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [], qualityGate: fixtures.qualityGateConfig });
    AllureReportMock.prototype.store = {
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    (glob as unknown as Mock).mockResolvedValueOnce([]);
    AllureReportMock.prototype.hasQualityGate = true;

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No test results directories found matching pattern:"),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(QualityGateCommand, ["quality-gate", "--known-issues", "foo"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      knownIssuesPath: "foo",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(QualityGateCommand, ["quality-gate"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      knownIssuesPath: undefined,
    });
  });
});
