import { AllureReport, readConfig } from "@allurereport/core";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { run } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
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

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: vi.fn(),
}));
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
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new DashboardCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`The given test results directory doesn't exist: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
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
    (existsSync as Mock).mockReturnValueOnce(true);
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

  it("should prefer CLI arguments over config and defaults", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(DashboardCommand, ["dashboard", "--output", "foo", "--report-name", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      name: "bar",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(DashboardCommand, ["dashboard", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
    });
  });
});
