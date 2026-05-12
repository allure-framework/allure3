import * as console from "node:console";
import { exit } from "node:process";

import { AllureReport, readConfig } from "@allurereport/core";
import LogPlugin from "@allurereport/plugin-log";
import { run } from "clipanion";
import { glob } from "glob";
import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { LogCommand } from "../../src/commands/log.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  allSteps: true,
  withTrace: true,
  groupBy: "suites",
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
  await story("log");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

describe("log command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (glob as unknown as Mock).mockResolvedValueOnce([]);

    await run(LogCommand, ["log", fixtures.resultsDir]);

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

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "log",
          enabled: true,
          options: expect.objectContaining({}),
          plugin: expect.any(LogPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-log-plugin1",
          enabled: true,
          options: {},
          plugin: new LogPlugin({}),
        },
        {
          id: "my-log-plugin2",
          enabled: true,
          options: {},
          plugin: new LogPlugin({}),
        },
      ],
    });
    (glob as unknown as Mock).mockResolvedValueOnce([`${fixtures.resultsDir}/`]);

    await run(LogCommand, ["log", fixtures.resultsDir]);

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            plugin: expect.any(LogPlugin),
          }),
        ]),
      }),
    );
  });

  it("should support multiple resultsDir", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (glob as unknown as Mock).mockResolvedValueOnce(["./foo/"]);
    (glob as unknown as Mock).mockResolvedValueOnce(["./bar/"]);

    await run(LogCommand, ["log", "foo", "bar"]);

    expect(glob).toHaveBeenCalledTimes(2);
    expect(glob).toHaveBeenNthCalledWith(1, "foo", expect.any(Object));
    expect(glob).toHaveBeenNthCalledWith(2, "bar", expect.any(Object));

    expect(AllureReport.prototype.readDirectory).toHaveBeenCalledTimes(2);
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(1, "./foo/");
    expect(AllureReport.prototype.readDirectory).toHaveBeenNthCalledWith(2, "./bar/");
  });
});
