import { exit } from "node:process";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  realpath: vi.fn().mockResolvedValue(""),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quality-gate command", () => {
  it("should exits with code 0 when quality gate validation fails", async () => {
    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    AllureReportMock.prototype.realtimeSubscriber = {
      onTerminationRequest: (cb: (code: number) => void) => {},
    };

    await command.execute();

    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exits with code 1 when receives termination process mesa", async () => {
    let onTerminationRequestCb: (code: number) => void;
    const command = new QualityGateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.config;

    AllureReportMock.prototype.realtimeSubscriber = {
      onTerminationRequest: (cb: (code: number) => void) => {
        onTerminationRequestCb = cb;
      },
    };

    const commandPromise = command.execute();

    // flush pending realpath promise
    await Promise.resolve();
    // flush pending readConfig promise
    await Promise.resolve();

    onTerminationRequestCb!(1);

    await commandPromise;

    expect(exit).toHaveBeenCalledWith(1);
  });
});
