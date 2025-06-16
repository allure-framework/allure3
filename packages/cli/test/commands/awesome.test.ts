import { AllureReport, readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { AwesomeCommandAction } from "../../src/commands/awesome.js";

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

describe("awesome command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({});

    await AwesomeCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "awesome",
            enabled: true,
            options: {
              groupBy: undefined,
            },
            plugin: expect.any(AwesomePlugin),
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
          id: "my-awesome-plugin",
          enabled: true,
          options: {
            groupBy: ["foo", "bar"],
          },
          plugin: new AwesomePlugin({
            groupBy: ["foo", "bar"],
          }),
        },
      ],
    });

    await AwesomeCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-awesome-plugin",
            enabled: true,
            options: {
              groupBy: ["foo", "bar"],
            },
            plugin: expect.any(AwesomePlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      reportName: "Custom Allure Report",
      output: "./custom/output/path",
      knownIssues: "./custom/known/issues/path",
      historyPath: "./custom/history/path",
      reportLanguage: "es",
      singleFile: true,
      logo: "./custom/logo.png",
      config: "./custom/allurerc.mjs",
    };

    await AwesomeCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      knownIssues: fixtures.knownIssues,
      historyPath: fixtures.historyPath,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
      logo: fixtures.logo,
      config: fixtures.config,
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config, {
      historyPath: fixtures.historyPath,
      knownIssuesPath: fixtures.knownIssues,
      name: fixtures.reportName,
      output: fixtures.output,
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "awesome",
            enabled: true,
            options: {
              groupBy: undefined,
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
              logo: fixtures.logo,
            },
          }),
        ]),
      }),
    );
  });
});
