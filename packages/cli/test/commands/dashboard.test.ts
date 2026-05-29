import * as console from "node:console";
import { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
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
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    readConfig: vi.fn(),
    AllureReport: AllureReportMock,
  };
});
vi.mock("glob", async () => {
  return {
    glob: vi.fn(),
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("dashboard");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

describe("dashboard command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(DashboardCommand, ["dashboard", fixtures.resultsDir]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`No test results directories found matching pattern: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(DashboardCommand, ["dashboard", fixtures.resultsDir]);

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
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(DashboardCommand, ["dashboard", fixtures.resultsDir]);

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
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);

    await run(DashboardCommand, ["dashboard", "--output", "foo", "--report-name", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      name: "bar",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./allure-results/"]);

    await run(DashboardCommand, ["dashboard", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
    });
  });

  it("should support multiple resultsDir", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar/"]);

    await run(DashboardCommand, ["dashboard", "foo", "bar"]);

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", expect.any(Object));
    expect(glob).toHaveBeenNthCalledWith(2, "bar", expect.any(Object));

    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(2);
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo/");
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./bar/");
  });
});
