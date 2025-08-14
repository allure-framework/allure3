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
});
