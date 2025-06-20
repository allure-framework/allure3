import { AllureReport, readConfig } from "@allurereport/core";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardCommandAction } from "../../src/commands/dashboard.js";

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

describe("dashboard command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({});

    await DashboardCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dashboard",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: "en",
            }),
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    const resultsDir = "foo/bar/allure-results";

    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-dashboard-plugin",
          enabled: true,
          options: {
            reportLanguage: "en",
            singleFile: true,
            logo: "./logo.png",
          },
          plugin: new DashboardPlugin({
            reportLanguage: "en",
            singleFile: true,
            logo: "./logo.png",
          }),
        },
      ],
    });

    await DashboardCommandAction(resultsDir, {});

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-dashboard-plugin",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: "en",
              singleFile: true,
              logo: "./logo.png",
            }),
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      resultsDir: "foo/bar/allure-results",
      reportName: "Custom Allure Report",
      output: "./custom/output/path",
      reportLanguage: "es",
      singleFile: true,
      logo: "./custom/logo.png",
      config: "./custom/allurerc.mjs",
    };

    await DashboardCommandAction(fixtures.resultsDir, {
      reportName: fixtures.reportName,
      output: fixtures.output,
      reportLanguage: fixtures.reportLanguage,
      singleFile: fixtures.singleFile,
      logo: fixtures.logo,
      config: fixtures.config,
    });

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config, {
      name: fixtures.reportName,
      output: fixtures.output,
    });
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dashboard",
            enabled: true,
            options: expect.objectContaining({
              reportLanguage: fixtures.reportLanguage,
              singleFile: fixtures.singleFile,
              logo: fixtures.logo,
            }),
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });
});
