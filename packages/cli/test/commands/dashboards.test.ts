import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureReportMock } from "../utils.js";

const core = await import("@allurereport/core");
const { DashboardsCommandAction } = await import("../../src/commands/dashboards.js");

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

describe("awesome command", () => {
  it("should initialize allure report with a correct default plugin options", async () => {
    const resultsDir = "foo/bar/allure-results";

    await DashboardsCommandAction(resultsDir, {});

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: {
        "@allurereport/plugin-dashboards": {
          options: {
            groupBy: undefined,
          },
        },
      },
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Allure Report",
        history: [],
        plugins: [
          expect.objectContaining({
            id: "plugin-dashboards",
            enabled: true,
            options: {
              groupBy: undefined,
            },
          }),
        ],
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

    await DashboardsCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      knownIssues: fixtures.knownIssues,
      historyPath: fixtures.historyPath,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
      logo: fixtures.logo,
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      name: "Custom Allure Report",
      output: fixtures.output,
      knownIssuesPath: fixtures.knownIssues,
      historyPath: fixtures.historyPath,
      plugins: {
        "@allurereport/plugin-dashboards": {
          options: {
            groupBy: undefined,
            reportLanguage: fixtures.reportLanguage,
            singleFile: fixtures.singleFile,
            logo: fixtures.logo,
          },
        },
      },
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        name: fixtures.reportName,
        history: [],
        plugins: [
          expect.objectContaining({
            id: "plugin-dashboards",
            enabled: true,
            options: {
              groupBy: undefined,
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
              logo: fixtures.logo,
            },
          }),
        ],
      }),
    );
  });
});
