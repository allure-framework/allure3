import { AllureReport, readConfig } from "@allurereport/core";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardCommand } from "../../src/commands/dashboard.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  reportName: "Custom Allure Report",
  output: "./custom/output/path",
  reportLanguage: "es",
  singleFile: true,
  logo: "./custom/logo.png",
  theme: "dark",
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

describe("dashboard command", () => {
  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});

    const command = new DashboardCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "dashboard",
          enabled: true,
          plugin: expect.any(DashboardPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
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

    const command = new DashboardCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-dashboard-plugin",
            enabled: true,
            options: {
              reportLanguage: "en",
              singleFile: true,
              logo: "./logo.png",
            },
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });

  it("should initialize allure report with provided command line options", async () => {
    const command = new DashboardCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.reportName = fixtures.reportName;
    command.output = fixtures.output;
    command.reportLanguage = fixtures.reportLanguage;
    command.singleFile = fixtures.singleFile;
    command.logo = fixtures.logo;
    command.theme = fixtures.theme;
    command.config = fixtures.config;

    await command.execute();

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
              theme: fixtures.theme,
            }),
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });
});
