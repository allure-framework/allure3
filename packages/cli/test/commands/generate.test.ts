import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/commands/commons/generate.js";
import { GenerateCommand } from "../../src/commands/generate.js";

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

describe("generate command", () => {
  it("should call generate with correct parameters when results directory is provided", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "allure-report", open: false },
      resultsDir: "./allure-results",
      stage: expect.any(Object),
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with default results directory when not provided", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = undefined;

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { open: false },
      resultsDir: "./**/allure-results",
      stage: expect.any(Object),
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with stage files when provided", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = undefined;
    command.stage = ["stage1.zip", "stage2.zip"];

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { open: false },
      resultsDir: "./**/allure-results",
      stage: ["stage1.zip", "stage2.zip"],
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with both stage files and results directory", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { open: false },
      resultsDir: "./allure-results",
      stage: expect.any(Object),
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--output", "foo", "--report-name", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      name: "bar",
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: { open: false },
      resultsDir: "./allure-results",
      stage: undefined,
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: { open: false },
      resultsDir: "./allure-results",
      stage: undefined,
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should pass config to generate function", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ output: "custom-output", open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--config", "./custom-config.js", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), "./custom-config.js", {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: { output: "custom-output", open: false },
      resultsDir: "./allure-results",
      stage: undefined,
    });
    expect(serve).not.toHaveBeenCalled();
  });

  it("should propagate errors from generate function", async () => {
    const error = new Error("Generate failed");
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockRejectedValue(error);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await expect(command.execute()).rejects.toThrow("Generate failed");
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call serve when open flag is true", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.open = true;

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "allure-report", open: true },
      resultsDir: "./allure-results",
      stage: expect.any(Object),
    });
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: "allure-report",
      open: true,
    });
  });

  it("should pass port to serve when open flag is true and port is specified", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: true, port: "8080" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.open = true;
    command.port = "8080";

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "allure-report", open: true, port: "8080" },
      resultsDir: "./allure-results",
      stage: expect.any(Object),
    });
    expect(serve).toHaveBeenCalledWith({
      port: 8080,
      servePath: "allure-report",
      open: true,
    });
  });

  it("should not call serve when open flag is false", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.open = false;

    await command.execute();

    expect(generate).toHaveBeenCalled();
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function when open is true", async () => {
    const error = new Error("Serve failed");
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockRejectedValue(error);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.open = true;

    await expect(command.execute()).rejects.toThrow("Serve failed");
    expect(generate).toHaveBeenCalled();
  });
});
