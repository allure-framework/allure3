import { AllureReport, readConfig } from "@allurereport/core";
import ClassicPlugin from "@allurereport/plugin-classic";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassicCommand } from "../../src/commands/classic.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  reportName: "Custom Allure Report",
  output: "./custom/output/path",
  knownIssues: "./custom/known/issues/path",
  historyPath: "./custom/history/path",
  reportLanguage: "es",
  singleFile: true,
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

describe("classic command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new ClassicCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "classic",
          enabled: true,
          plugin: expect.any(ClassicPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-classic-plugin",
          enabled: true,
          options: {
            groupBy: ["foo", "bar"],
          },
          plugin: new ClassicPlugin({
            groupBy: ["foo", "bar"],
          }),
        },
      ],
    });

    const command = new ClassicCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-classic-plugin",
            enabled: true,
            options: {
              groupBy: ["foo", "bar"],
            },
            plugin: expect.any(ClassicPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const command = new ClassicCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.reportName = fixtures.reportName;
    command.output = fixtures.output;
    command.knownIssues = fixtures.knownIssues;
    command.historyPath = fixtures.historyPath;
    command.reportLanguage = fixtures.reportLanguage;
    command.singleFile = fixtures.singleFile;
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
            id: "classic",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
            }),
            plugin: expect.any(ClassicPlugin),
          }),
        ]),
      }),
    );
  });
});
