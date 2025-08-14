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
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });

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

  it("should initialize allure report with default plugin options even when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-dashboard-plugin1",
          enabled: true,
          options: {},
          plugin: new DashboardPlugin({}),
        },
        {
          id: "my-dashboard-plugin2",
          enabled: true,
          options: {},
          plugin: new DashboardPlugin({}),
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
            id: "dashboard",
            plugin: expect.any(DashboardPlugin),
          }),
        ]),
      }),
    );
  });
});
