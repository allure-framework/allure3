import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin from "@allurereport/plugin-csv";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CsvCommand } from "../../src/commands/csv.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  output: "./custom/output/path.csv",
  knownIssues: "./custom/known/issues/path",
  separator: ";",
  disableHeaders: true,
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

describe("csv command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new CsvCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "csv",
          enabled: true,
          options: expect.objectContaining({}),
          plugin: expect.any(CsvPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-csv-plugin",
          enabled: true,
          options: {
            separator: ";",
            disableHeaders: true,
          },
          plugin: new CsvPlugin({
            separator: ";",
            disableHeaders: true,
          }),
        },
      ],
    });

    const command = new CsvCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-csv-plugin",
            enabled: true,
            options: {
              separator: ";",
              disableHeaders: true,
            },
            plugin: expect.any(CsvPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const command = new CsvCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.output = fixtures.output;
    command.knownIssues = fixtures.knownIssues;
    command.separator = fixtures.separator;
    command.disableHeaders = fixtures.disableHeaders;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config, {
      knownIssuesPath: fixtures.knownIssues,
      output: fixtures.output,
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            enabled: true,
            options: expect.objectContaining({
              separator: fixtures.separator,
              disableHeaders: fixtures.disableHeaders,
            }),
            plugin: expect.any(CsvPlugin),
          }),
        ]),
      }),
    );
  });
});
