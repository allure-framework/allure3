import { AllureReport, readConfig } from "@allurereport/core";
import { KnownError } from "@allurereport/service";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { glob } from "glob";
import * as console from "node:console";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenCommand } from "../../src/commands/open.js";
import { logError } from "../../src/utils/logs.js";
import { AllureReportMock } from "../utils.js";

vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    AllureReport: utils.AllureReportMock,
    readConfig: vi.fn(),
  };
});
vi.mock("@allurereport/static-server", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    serve: vi.fn(),
  };
});
vi.mock("../../src/utils/logs.js", () => ({
  logError: vi.fn(),
}));
vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("open command", () => {
  it("should exit with code 1 when there are no results directory", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({});

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./notfound";

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No test results directories found matching pattern: ./notfound"),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
    expect(serve).not.toHaveBeenCalled();
  });

  it("should serve with custom options", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./custom-results/"]);
    (readConfig as Mock).mockResolvedValue({ output: "custom-report" });

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./custom-results";
    command.port = "8080";
    command.live = true;
    command.config = "./custom/allurerc.mjs";
    command.output = "custom-report";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", "./custom/allurerc.mjs", { output: "custom-report" });
    expect(serve).toHaveBeenCalledWith({
      port: 8080,
      servePath: "custom-report",
      live: true,
      open: true,
    });
  });

  it("should handle known errors and exit with code 1 without errors logging", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    AllureReportMock.prototype.start.mockRejectedValueOnce(new KnownError("known error"));

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = undefined;

    await command.execute();

    expect(logError).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("known error"));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should handle unknown errors and exit with code 1 with errors logging", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});
    AllureReportMock.prototype.start.mockRejectedValueOnce(new Error("unknown error"));

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = undefined;

    await command.execute();

    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Failed to generate report"), expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});

    await run(OpenCommand, ["open", "--output", "foo", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./allure-results/"]);
    (readConfig as Mock).mockResolvedValue({});

    await run(OpenCommand, ["open"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
    });
  });
});
