import { AllureReport, readConfig } from "@allurereport/core";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { QualityGateCommand } from "../../src/commands/qualityGate.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  config: "./custom/allurerc.mjs",
  cwd: ".",
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
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quality-gate command", () => {
  it("should pass when validation succeeds (exitCode === 0)", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    Object.defineProperty(AllureReport.prototype, "exitCode", {
      get: vi.fn(() => 0),
      configurable: true,
    });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, fixtures.config);
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.start).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledWith(fixtures.resultsDir);
    expect(AllureReport.prototype.done).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.validate).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("should fail and exit with error code when validation fails", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    Object.defineProperty(AllureReport.prototype, "exitCode", {
      get: vi.fn(() => 1),
      configurable: true,
    });
    Object.defineProperty(AllureReport.prototype, "validationResults", {
      get: vi.fn(() => [
        {
          success: false,
          rule: "failurePercentage",
          expected: "< 5%",
          actual: "10%",
          meta: {
            type: "label",
            name: "suite",
            value: "UI Tests",
          },
        },
      ]),
      configurable: true,
    });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.validate).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should handle different types of validation errors", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    Object.defineProperty(AllureReport.prototype, "exitCode", {
      get: vi.fn(() => 1),
      configurable: true,
    });
    Object.defineProperty(AllureReport.prototype, "validationResults", {
      get: vi.fn(() => [
        {
          success: false,
          rule: "failurePercentage",
          expected: "< 5%",
          actual: "10%",
          meta: {
            type: "label",
            name: "suite",
            value: "UI Tests",
          },
        },
        {
          success: false,
          rule: "testCount",
          expected: "> 100",
          actual: "50",
          meta: {
            type: "parameter",
            name: "browser",
            value: "chrome",
          },
        },
        {
          success: false,
          rule: "flakiness",
          expected: "< 1%",
          actual: "3%",
        },
      ]),
      configurable: true,
    });

    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport.prototype.validate).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(5);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
