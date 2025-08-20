import { readConfig, stringifyQualityGateResults } from "@allurereport/core";
import { findMatching } from "@allurereport/directory-watcher";
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
vi.mock("@allurereport/directory-watcher", () => ({
  findMatching: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
    stringifyQualityGateResults: vi.fn(),
    AllureReport: AllureReportMock,
  };
});
vi.mock("@allurereport/directory-watcher", () => ({
  findMatching: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quality-gate command", () => {
  it("should exit with code 0 when there are no quality gate violations", async () => {
    (findMatching as Mock).mockImplementation((cwd: string, dirs: Set<string>) => {
      dirs.add("./allure-results");
    });
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true as any;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: (_cb: (ids: string[]) => void) => {},
    } as any;
    (AllureReportMock.prototype as any).store = {
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

    (findMatching as Mock).mockImplementation((cwd: string, dirs: Set<string>) => {
      dirs.add("./allure-results");
    });
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true as any;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: (cb: (ids: string[]) => void) => {
        onTestResultsCb = cb;
      },
    } as any;
    (AllureReportMock.prototype as any).store = {
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
    (findMatching as unknown as Mock).mockImplementationOnce(async (cwd: string, set: Set<string>) => {
      set.add("dir1/allure-results");
      set.add("dir2/allure-results");
    });
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    AllureReportMock.prototype.hasQualityGate = true as any;
    AllureReportMock.prototype.realtimeSubscriber = {
      onTestResults: (_cb: (ids: string[]) => void) => {},
    } as any;
    (AllureReportMock.prototype as any).store = {
      allTestResults: vi.fn().mockResolvedValue([]),
      testResultById: vi.fn(),
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    (AllureReportMock.prototype.validate as unknown as Mock).mockResolvedValueOnce({ results: [] });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined;

    await command.execute();

    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("dir1/allure-results");
    expect(AllureReportMock.prototype.readDirectory).toHaveBeenCalledWith("dir2/allure-results");
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exit with code 0 and print a message when no results directories found", async () => {
    (findMatching as unknown as Mock).mockImplementationOnce(async (_targetDir: string, _set: Set<string>) => {});
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    (AllureReportMock.prototype.validate as unknown as Mock).mockResolvedValueOnce({ results: [] });

    const errorSpy = vi.spyOn(console, "error");
    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined as any;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
    expect(errorSpy).toHaveBeenCalledWith("No Allure results directories found");
  });

  it("should exit with code -1 when quality gate is not configured", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });
    (AllureReportMock.prototype as any).store = {
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    AllureReportMock.prototype.hasQualityGate = false as any;

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

  it("should exit with code 0 when there is no test results found", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [], qualityGate: fixtures.qualityGateConfig });
    (AllureReportMock.prototype as any).store = {
      allKnownIssues: vi.fn().mockResolvedValue([]),
    };
    (findMatching as Mock).mockImplementation(async () => {});
    AllureReportMock.prototype.hasQualityGate = true as any;

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
  });
});
