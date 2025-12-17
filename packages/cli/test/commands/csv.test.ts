import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin from "@allurereport/plugin-csv";
import { run } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
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

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: vi.fn(),
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

describe("csv command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new CsvCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Given test results directory doesn't exist: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
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
    (existsSync as Mock).mockReturnValueOnce(true);
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
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(CsvCommand, ["csv", "--output", "foo", "--known-issues", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      knownIssuesPath: "bar",
    });
  });

  it("should set output to default and take other props from readConfig if no CLI arguments provided", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(CsvCommand, ["csv", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "allure.csv",
      knownIssuesPath: undefined,
    });
  });
});
