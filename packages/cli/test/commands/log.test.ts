import { AllureReport, readConfig } from "@allurereport/core";
import LogPlugin from "@allurereport/plugin-log";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { LogCommandAction } from "../../src/commands/log.js";

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
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({});

    await LogCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            enabled: true,
            options: expect.objectContaining({}),
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    const resultsDir = "foo/bar/allure-results";

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

    await LogCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-log-plugin",
            enabled: true,
            options: expect.objectContaining({
              allSteps: true,
              withTrace: true,
              groupBy: "features",
            }),
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      allSteps: true,
      withTrace: true,
      groupBy: "suites",
      config: "./custom/allurerc.mjs",
    } as const;

    await LogCommandAction(fixtures.resultsDir, {
      allSteps: fixtures.allSteps,
      withTrace: fixtures.withTrace,
      groupBy: fixtures.groupBy,
      config: fixtures.config,
    });

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
