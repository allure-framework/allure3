import { AllureReport, readConfig } from "@allurereport/core";
import Allure2Plugin from "@allurereport/plugin-allure2";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { Allure2Command } from "../../src/commands/allure2.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  reportName: "Custom Allure2 Report",
  output: "./custom/output/path",
  knownIssues: "./custom/known/issues/path",
  historyPath: "./custom/history/path",
  reportLanguage: "en",
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

describe("allure2 command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });

    const command = new Allure2Command();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "allure2",
          plugin: expect.any(Allure2Plugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with default plugin options even when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-allure2-plugin1",
          enabled: true,
          options: {},
          plugin: new Allure2Plugin({}),
        },
        {
          id: "my-allure2-plugin2",
          enabled: true,
          options: {},
          plugin: new Allure2Plugin({}),
        },
      ],
    });

    const command = new Allure2Command();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "allure2",
            plugin: expect.any(Allure2Plugin),
          }),
        ]),
      }),
    );
  });
});
