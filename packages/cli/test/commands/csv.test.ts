import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import CsvPlugin from "@allurereport/plugin-csv";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { CsvCommand } from "../../src/commands/csv.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  output: "custom-output.csv",
  absoluteOutput: "/absolute/path/custom-output.csv",
  knownIssues: "./custom/known/issues/path",
  separator: ";",
  disableHeaders: true,
  config: "./custom/allurerc.mjs",
  cwd: "/foo/bar",
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn(),
}));
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    readConfig: vi.fn(),
    AllureReport: AllureReportMock,
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
  await story("csv");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  (realpath as Mock).mockResolvedValue(fixtures.cwd);
});

describe("csv command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(CsvCommand, ["csv", fixtures.resultsDir]);

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

    await run(CsvCommand, ["csv", fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, undefined, {
      knownIssuesPath: undefined,
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "csv",
          enabled: true,
          options: expect.objectContaining({
            separator: ",",
            disableHeaders: false,
            fileName: undefined,
          }),
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
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, ["csv", fixtures.resultsDir]);

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
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, [
      "csv",
      "--output",
      fixtures.output,
      "--known-issues",
      fixtures.knownIssues,
      "--separator",
      fixtures.separator,
      "--disable-headers",
      fixtures.resultsDir,
    ]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, undefined, {
      knownIssuesPath: fixtures.knownIssues,
    });
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            options: expect.objectContaining({
              separator: fixtures.separator,
              disableHeaders: true,
              fileName: join(fixtures.cwd, fixtures.output),
            }),
          }),
        ]),
      }),
    );
  });

  it("should set output to default and take other props from readConfig if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, ["csv", fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, undefined, {
      knownIssuesPath: undefined,
    });
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            options: expect.objectContaining({
              separator: ",",
              disableHeaders: false,
              fileName: undefined,
            }),
          }),
        ]),
      }),
    );
  });

  it("should use absolute path directly when output is absolute", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, ["csv", "--output", fixtures.absoluteOutput, fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            options: expect.objectContaining({
              fileName: fixtures.absoluteOutput,
            }),
          }),
        ]),
      }),
    );
  });

  it("should pass custom config path to readConfig", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, ["csv", "--config", fixtures.config, fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, fixtures.config, {
      knownIssuesPath: undefined,
    });
  });

  it("should use custom cwd when provided", async () => {
    const customCwd = "/custom/working/directory";
    (realpath as Mock).mockResolvedValueOnce(customCwd);
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, ["csv", "--cwd", customCwd, fixtures.resultsDir]);

    expect(realpath).toHaveBeenCalledWith(customCwd);
    expect(readConfig).toHaveBeenCalledWith(customCwd, undefined, {
      knownIssuesPath: undefined,
    });
  });

  it("should combine config, cwd, and output options correctly", async () => {
    const customCwd = "/custom/working/directory";
    (realpath as Mock).mockResolvedValueOnce(customCwd);
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(CsvCommand, [
      "csv",
      "--config",
      fixtures.config,
      "--cwd",
      customCwd,
      "--output",
      fixtures.output,
      fixtures.resultsDir,
    ]);

    expect(realpath).toHaveBeenCalledWith(customCwd);
    expect(readConfig).toHaveBeenCalledWith(customCwd, fixtures.config, {
      knownIssuesPath: undefined,
    });
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "csv",
            options: expect.objectContaining({
              fileName: join(customCwd, fixtures.output),
            }),
          }),
        ]),
      }),
    );
  });

  it("should support multiple resultsDir", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar/"]);

    await run(CsvCommand, ["csv", "foo", "bar"]);

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", expect.any(Object));
    expect(glob).toHaveBeenNthCalledWith(2, "bar", expect.any(Object));

    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(2);
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo/");
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./bar/");
  });
});
