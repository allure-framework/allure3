import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/commands/commons/generate.js";
import { OpenCommand } from "../../src/commands/open.js";

vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
  };
});
vi.mock("@allurereport/static-server", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    serve: vi.fn(),
  };
});

vi.mock("../../src/commands/commons/generate.js", () => ({
  generate: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("open command", () => {
  it("should call generate and serve when results directory is provided", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "allure-report" },
      resultsDir: "./allure-results",
    });
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: "allure-report",
      open: true,
    });
  });

  it("should use default results directory when not provided", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = undefined;

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: {},
      resultsDir: "./**/allure-results",
    });
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: undefined,
      open: true,
    });
  });

  it("should serve with custom options", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "custom-report", port: "8080" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./custom-results";
    command.port = "8080";
    command.config = "./custom/allurerc.mjs";
    command.output = "custom-report";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", "./custom/allurerc.mjs", {
      output: "custom-report",
      port: "8080",
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "custom-report", port: "8080" },
      resultsDir: "./custom-results",
    });
    expect(serve).toHaveBeenCalledWith({
      port: 8080,
      servePath: "custom-report",
      open: true,
    });
  });

  it("should handle errors from generate function", async () => {
    const error = new Error("Generate failed");
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await expect(command.execute()).rejects.toThrow("Generate failed");
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function", async () => {
    const error = new Error("Serve failed");
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await expect(command.execute()).rejects.toThrow("Serve failed");
    expect(generate).toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--output", "foo", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: {},
      resultsDir: "./allure-results",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: {},
      resultsDir: "./**/allure-results",
    });
  });

  it("should parse port from config and pass as number to serve", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "report", port: "3000" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.port = "3000";

    await command.execute();

    expect(serve).toHaveBeenCalledWith({
      port: 3000,
      servePath: "report",
      open: true,
    });
  });
});
