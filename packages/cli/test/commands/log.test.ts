import * as console from "node:console";
import { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import LogPlugin from "@allurereport/plugin-log";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { LogCommand } from "../../src/commands/log.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  allSteps: true,
  withTrace: true,
  groupBy: "suites",
  config: "./custom/allurerc.mjs",
  qualityGateValidationResults: [
    {
      success: false,
      rule: "maxFailures",
      message: "The number of failed tests 1 exceeds the allowed threshold value 0",
      actual: 1,
      expected: 0,
      testResults: ["failed-1"],
    },
  ] as QualityGateValidationResult[],
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");
  const environmentIdentityById = vi.fn((environments: Record<string, { name?: string }>, environmentId: string) => {
    const descriptor = environments[environmentId];

    return descriptor ? { id: environmentId, name: descriptor.name ?? environmentId } : undefined;
  });
  const environmentIdentityByName = vi.fn(
    (environments: Record<string, { name?: string }>, environmentName: string) => {
      for (const [id, descriptor] of Object.entries(environments)) {
        if ((descriptor?.name ?? id) === environmentName) {
          return {
            id,
            name: descriptor?.name ?? id,
          };
        }
      }

      return undefined;
    },
  );

  return {
    readConfig: vi.fn(),
    AllureReport: AllureReportMock,
    environmentIdentityById,
    environmentIdentityByName,
    validateAllowedEnvironmentId: vi.fn(),
  };
});
vi.mock("glob", async () => {
  return {
    glob: vi.fn(),
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("log");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  (AllureReport.prototype as unknown as { hasQualityGate: boolean }).hasQualityGate = false;
  (readConfig as Mock).mockResolvedValue({ plugins: [] });
});

describe("log command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`No test results directories found matching pattern: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "log",
          enabled: true,
          options: expect.objectContaining({
            qualityGateResults: true,
          }),
          plugin: expect.any(LogPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-log-plugin1",
          enabled: true,
          options: {},
          plugin: new LogPlugin({}),
        },
        {
          id: "my-log-plugin2",
          enabled: true,
          options: {},
          plugin: new LogPlugin({}),
        },
      ],
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });

  it("should pass disabled quality gate results logging to the log plugin", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);
    (AllureReport.prototype as unknown as { hasQualityGate: boolean }).hasQualityGate = true;

    await run(LogCommand, ["log", "--no-quality-gate-results", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            options: expect.objectContaining({
              qualityGateResults: false,
            }),
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
    expect(AllureReport.prototype.validate).not.toHaveBeenCalled();
    expect(AllureReport.prototype.realtimeDispatcher.sendQualityGateResults).not.toHaveBeenCalled();
  });

  it("should validate configured quality gate and publish results before done", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
      qualityGate: {
        rules: [{ maxFailures: 0 }],
      },
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);
    (AllureReport.prototype as unknown as { hasQualityGate: boolean }).hasQualityGate = true;
    (AllureReport.prototype.store.allTestResults as Mock).mockResolvedValueOnce([{ id: "failed-1", status: "failed" }]);
    (AllureReport.prototype.validate as Mock).mockResolvedValueOnce({
      results: fixtures.qualityGateValidationResults,
    });

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport.prototype.store.allTestResults).toHaveBeenCalledWith({ includeRetries: false });
    expect(AllureReport.prototype.validate).toHaveBeenCalledWith({
      trs: [{ id: "failed-1", status: "failed" }],
      environment: undefined,
    });
    expect(AllureReport.prototype.realtimeDispatcher.sendQualityGateResults).toHaveBeenCalledWith(
      fixtures.qualityGateValidationResults,
    );
    expect(
      vi.mocked(AllureReport.prototype.realtimeDispatcher.sendQualityGateResults).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(AllureReport.prototype.done).mock.invocationCallOrder[0]);
  });

  it("should resolve configured environment for quality gate validation", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
      environment: "Production",
      environments: {
        prod: {
          name: "Production",
        },
      },
      qualityGate: {
        rules: [{ maxFailures: 0 }],
      },
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);
    (AllureReport.prototype as unknown as { hasQualityGate: boolean }).hasQualityGate = true;
    (AllureReport.prototype.store.allTestResults as Mock).mockResolvedValueOnce([{ id: "failed-1", status: "failed" }]);
    (AllureReport.prototype.validate as Mock).mockResolvedValueOnce({
      results: fixtures.qualityGateValidationResults,
    });

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "prod",
      }),
    );
    expect(AllureReport.prototype.validate).toHaveBeenCalledWith({
      trs: [{ id: "failed-1", status: "failed" }],
      environment: "prod",
    });
  });

  it("should support multiple resultsDir", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar/"]);

    await run(LogCommand, ["log", "foo", "bar"]);

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", expect.any(Object));
    expect(glob).toHaveBeenNthCalledWith(2, "bar", expect.any(Object));

    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(2);
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo/");
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./bar/");
  });
});
