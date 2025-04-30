import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureReportMock } from "../utils.js";

const core = await import("@allurereport/core");
const { ClassicCommandAction } = await import("../../src/commands/classic.js");

vi.spyOn(core, "resolveConfig");
vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classic command", () => {
  it("should initialize allure report with a correct default plugin options", async () => {
    const resultsDir = "foo/bar/allure-results";

    await ClassicCommandAction(resultsDir, {});

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-classic": {
          options: {
            groupBy: undefined,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Allure Report",
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-classic",
            enabled: true,
            options: {
              groupBy: undefined,
            },
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with a provided plugin options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      reportName: "Custom Allure Report",
      output: "./custom/output/path",
      knownIssues: "./custom/known/issues/path",
      historyPath: "./custom/history/path",
      reportLanguage: "es",
      singleFile: true,
      logo: "./custom/logo.png",
    };

    await ClassicCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      knownIssues: fixtures.knownIssues,
      historyPath: fixtures.historyPath,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      name: "Custom Allure Report",
      output: fixtures.output,
      knownIssuesPath: fixtures.knownIssues,
      historyPath: fixtures.historyPath,
      plugins: expect.objectContaining({
        "@allurereport/plugin-classic": {
          options: {
            groupBy: undefined,
            reportLanguage: fixtures.reportLanguage,
            singleFile: fixtures.singleFile,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: fixtures.reportName,
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-classic",
            enabled: true,
            options: {
              groupBy: undefined,
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
            },
          }),
        ]),
      }),
    );
  });
});
