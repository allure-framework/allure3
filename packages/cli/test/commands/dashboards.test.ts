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

describe("dashboards command", () => {
  it("should initialize allure report with a correct default plugin options", async () => {
    const resultsDir = "foo/bar/allure-results";

    await DashboardsCommandAction(resultsDir, {});

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: {
        "@allurereport/plugin-dashboards": {
          options: {},
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
      reportLanguage: "es",
      singleFile: true,
      logo: "./custom/logo.png",
    };

    await DashboardsCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
      logo: fixtures.logo,
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      name: "Custom Allure Report",
      output: fixtures.output,
      plugins: {
        "@allurereport/plugin-dashboards": {
          options: {
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
