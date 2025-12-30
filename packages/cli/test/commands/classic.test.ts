import { AllureReport, readConfig } from "@allurereport/core";
import ClassicPlugin from "@allurereport/plugin-classic";
import { run } from "clipanion";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassicCommand } from "../../src/commands/classic.js";

const fixtures = {
  resultsDir: "foo/bar/allure-results",
  reportName: "Custom Allure Report",
  output: "./custom/output/path",
  knownIssues: "./custom/known/issues/path",
  historyPath: "./custom/history/path",
  reportLanguage: "es",
  singleFile: true,
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

describe("classic command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new ClassicCommand();

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

    const command = new ClassicCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "classic",
          enabled: true,
          plugin: expect.any(ClassicPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with default plugin options even when config exists", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-classic-plugin1",
          enabled: true,
          options: {},
          plugin: new ClassicPlugin({}),
        },
        {
          id: "my-classic-plugin2",
          enabled: true,
          options: {},
          plugin: new ClassicPlugin({}),
        },
      ],
    });

    const command = new ClassicCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "classic",
            plugin: expect.any(ClassicPlugin),
          }),
        ]),
      }),
    );
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(ClassicCommand, [
      "classic",
      "--report-name",
      "foo",
      "--output",
      "bar",
      "--known-issues",
      "baz",
      "--history-path",
      "qux",
      "./allure-results",
    ]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: "foo",
      output: "bar",
      knownIssuesPath: "baz",
      historyPath: "qux",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({});

    await run(ClassicCommand, ["classic", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      knownIssuesPath: undefined,
      historyPath: undefined,
    });
  });
});
