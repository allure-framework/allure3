import { readConfig } from "@allurereport/core";
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

vi.mock("../../src/commands/commons/generate.js", () => ({
  generate: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generate command", () => {
  it("should call generate with correct parameters when results directory is provided", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report" });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = [];

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: "allure-report" },
      resultsDir: "./allure-results",
      stage: [],
    });
  });

  it("should call generate with default results directory when not provided", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = undefined;
    command.stage = [];

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: {},
      resultsDir: "./**/allure-results",
      stage: [],
    });
  });

  it("should call generate with stage files when provided", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = undefined;
    command.stage = ["stage1.zip", "stage2.zip"];

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: {},
      resultsDir: "./**/allure-results",
      stage: ["stage1.zip", "stage2.zip"],
    });
  });

  it("should call generate with both stage files and results directory", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = ["stage1.zip", "stage2.zip"];

    await command.execute();

    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: {},
      resultsDir: "./allure-results",
      stage: ["stage1.zip", "stage2.zip"],
    });
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--output", "foo", "--report-name", "bar", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: "foo",
      name: "bar",
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: {},
      resultsDir: "./allure-results",
      stage: undefined,
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({});
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: {},
      resultsDir: "./allure-results",
      stage: undefined,
    });
  });

  it("should pass config to generate function", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ output: "custom-output" });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--config", "./custom-config.js", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), "./custom-config.js", {
      output: undefined,
      name: undefined,
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: expect.any(String),
      config: { output: "custom-output" },
      resultsDir: "./allure-results",
      stage: undefined,
    });
  });

  it("should propagate errors from generate function", async () => {
    const error = new Error("Generate failed");
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockRejectedValue(error);

    const command = new GenerateCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.stage = [];

    await expect(command.execute()).rejects.toThrow("Generate failed");
  });
});
