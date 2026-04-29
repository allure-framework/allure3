import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { LogCommand } from "../../src/commands/log.js";
import { AllureReportMock } from "../utils.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  allSteps: true,
  withTrace: true,
  groupBy: "suites",
  config: "./custom/allurerc.mjs",
};

const { LogPluginMock, readConfigMock } = vi.hoisted(() => ({
  LogPluginMock: vi.fn(function (this: { options?: unknown }, options?: unknown) {
    this.options = options;
  }),
  readConfigMock: vi.fn(),
}));

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
vi.mock("@allurereport/core", async () => {
  const { AllureReportMock } = await import("../utils.js");

  return {
    readConfig: readConfigMock,
    AllureReport: AllureReportMock,
  };
});
vi.mock("@allurereport/plugin-log", () => ({
  default: LogPluginMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("log command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`The given test results directory doesn't exist: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReportMock).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    readConfigMock.mockResolvedValueOnce({
      plugins: [],
    });

    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReportMock).toHaveBeenCalledTimes(1);
    expect(AllureReportMock).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "log",
          enabled: true,
          options: expect.objectContaining({}),
          plugin: expect.any(LogPluginMock),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    readConfigMock.mockResolvedValueOnce({
      plugins: [
        {
          id: "my-log-plugin1",
          enabled: true,
          options: {},
          plugin: new LogPluginMock({}),
        },
        {
          id: "my-log-plugin2",
          enabled: true,
          options: {},
          plugin: new LogPluginMock({}),
        },
      ],
    });

    const command = new LogCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReportMock).toHaveBeenCalledTimes(1);
    expect(AllureReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "log",
            plugin: expect.any(LogPluginMock),
          }),
        ]),
      }),
    );
  });
});
