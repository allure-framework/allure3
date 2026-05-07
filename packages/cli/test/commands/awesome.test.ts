import * as console from "node:console";
import { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { run } from "clipanion";
import { glob } from "glob";
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("awesome command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);
    (readConfig as Mock).mockResolvedValueOnce({ plugins: [] });

    await run(AwesomeCommand, ["awesome", fixtures.resultsDir]);

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

    await run(AwesomeCommand, ["awesome", fixtures.resultsDir]);

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

  it("should initialize allure report with default plugin options even when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-awesome-plugin1",
          enabled: true,
          options: {},
          plugin: new AwesomePlugin({}),
        },
        {
          id: "my-awesome-plugin2",
          enabled: true,
          options: {},
          plugin: new AwesomePlugin({}),
        },
      ],
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(AwesomeCommand, ["awesome", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "awesome",
            plugin: expect.any(AwesomePlugin),
          }),
        ]),
      }),
    );
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(AwesomeCommand, [
      "awesome",
      "--report-name",
      "foo",
      "--output",
      "bar",
      "--known-issues",
      "baz",
      "--history-path",
      "qux",
      "./allure-results",
    ]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: "foo",
      output: "bar",
      knownIssuesPath: "baz",
      historyPath: "qux",
      hideLabels: undefined,
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(AwesomeCommand, ["awesome", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      knownIssuesPath: undefined,
      historyPath: undefined,
      hideLabels: undefined,
    });
  });

  it("should pass hideLabels from CLI to awesome plugin options", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);
    const config = {
      hideLabels: ["owner", "tag"],
    };
    (readConfig as Mock).mockResolvedValueOnce(config);

    await run(AwesomeCommand, ["awesome", "--hide-labels", "owner", "--hide-labels", "tag", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      knownIssuesPath: undefined,
      historyPath: undefined,
      hideLabels: ["owner", "tag"],
    });
    const reportConfig = (AllureReport as Mock).mock.calls[0]?.[0];

    expect(reportConfig.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "awesome",
          options: {
            singleFile: false,
            logo: undefined,
            theme: undefined,
            reportLanguage: undefined,
            groupBy: ["parentSuite", "suite", "subSuite"],
          },
        }),
      ]),
    );
  });
});
