import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin from "@allurereport/plugin-csv";
import { run } from "clipanion";
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
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });

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

  it("should initialize allure report with default plugin options even when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-csv-plugin1",
          enabled: true,
          options: {},
          plugin: new CsvPlugin({}),
        },
        {
          id: "my-csv-plugin2",
          enabled: true,
          options: {},
          plugin: new CsvPlugin({}),
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
            id: "csv",
            plugin: expect.any(CsvPlugin),
          }),
        ]),
      }),
    );
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(CsvCommand, ["csv", "--output", "foo", "--known-issues", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      knownIssuesPath: "bar",
    });
  });

  it("should set output to default and take other props from readConfig if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(CsvCommand, ["csv", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "allure.csv",
      knownIssuesPath: undefined,
    });
  });
});
