import { AllureReport, readConfig } from "@allurereport/core";
import LogPlugin from "@allurereport/plugin-log";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { LogCommand } from "../../src/commands/log.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  allSteps: true,
  withTrace: true,
  groupBy: "suites",
  config: "./custom/allurerc.mjs",
};

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

describe("log command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "log",
          enabled: true,
          options: expect.objectContaining({}),
          plugin: expect.any(LogPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-log-plugin",
          enabled: true,
          options: {
            allSteps: true,
            withTrace: true,
            groupBy: "features",
          },
          plugin: new LogPlugin({
            allSteps: true,
            withTrace: true,
            groupBy: "features",
          }),
        },
      ],
    });

    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-log-plugin",
            enabled: true,
            options: {
              allSteps: true,
              withTrace: true,
              groupBy: "features",
            },
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.allSteps = fixtures.allSteps;
    command.withTrace = fixtures.withTrace;
    command.groupBy = fixtures.groupBy;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config);
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            enabled: true,
            options: expect.objectContaining({
              allSteps: fixtures.allSteps,
              withTrace: fixtures.withTrace,
              groupBy: fixtures.groupBy,
            }),
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });
});
