import { AllureReport, readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { AwesomeCommand } from "../../src/commands/awesome.js";

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
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new AwesomeCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "awesome",
          enabled: true,
          options: expect.objectContaining({
            groupBy: ["parentSuite", "suite", "subSuite"],
          }),
          plugin: expect.any(AwesomePlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
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

    const command = new AwesomeCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

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
    const command = new AwesomeCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.reportName = fixtures.reportName;
    command.output = fixtures.output;
    command.knownIssues = fixtures.knownIssues;
    command.historyPath = fixtures.historyPath;
    command.reportLanguage = fixtures.reportLanguage;
    command.singleFile = fixtures.singleFile;
    command.logo = fixtures.logo;
    command.config = fixtures.config;

    await command.execute();

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
            options: expect.objectContaining({
              groupBy: ["parentSuite", "suite", "subSuite"],
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
              logo: fixtures.logo,
            }),
          }),
        ]),
      }),
    );
  });
});
