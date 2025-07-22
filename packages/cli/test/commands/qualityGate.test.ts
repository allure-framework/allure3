import { readConfig, runQualityGate, stringifyQualityGateResults } from "@allurereport/core";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { QualityGateCommand } from "../../src/commands/qualityGate.js";

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

vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
    runQualityGate: vi.fn(),
    stringifyQualityGateResults: vi.fn(),
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quality-gate command", () => {
  it("should exit with code 1 when config doesn't have quality gate configuration", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(1);
    expect(runQualityGate).not.toHaveBeenCalled();
  });

  it("should exits with code 0 when quality gate validation succeeds", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      qualityGate: fixtures.qualityGateConfig,
    });
    (runQualityGate as Mock).mockResolvedValueOnce([]);

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
    expect(stringifyQualityGateResults).not.toHaveBeenCalled();
    expect(runQualityGate).toHaveBeenCalledWith(undefined, fixtures.qualityGateConfig);
  });

  it("should exits with code 1 when quality gate validation fails", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      qualityGate: fixtures.qualityGateConfig,
    });
    (runQualityGate as Mock).mockResolvedValueOnce(fixtures.qualityGateValidationResults);

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(exit).toHaveBeenCalledWith(1);
    expect(stringifyQualityGateResults).toHaveBeenCalled();
    expect(runQualityGate).toHaveBeenCalledWith(undefined, fixtures.qualityGateConfig);
  });
});
