import { AllureReport, readConfig } from "@allurereport/core";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { run } from "clipanion";
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
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });

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

    const command = new AwesomeCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

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
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(AwesomeCommand, ["awesome", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      knownIssuesPath: undefined,
      historyPath: undefined,
    });
  });
});
