import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { join } from "node:path";
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
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
      output: "allure-report",
    };

    (readConfig as Mock).mockResolvedValue({ output: fixtures.output, open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { output: fixtures.output, open: false },
        resultsDir: fixtures.resultsDir,
        dump: expect.any(Object),
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with default results directory when not provided", async () => {
    const fixtures = {
      cwd: ".",
      defaultResultsDir: "./**/allure-results",
    };

    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { open: false },
        resultsDir: fixtures.defaultResultsDir,
        dump: expect.any(Object),
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with dump files when provided", async () => {
    const fixtures = {
      cwd: ".",
      defaultResultsDir: "./**/allure-results",
      dump: ["dump.zip", "dump.zip"],
    };

    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = undefined;
    command.dump = fixtures.dump;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { open: false },
        resultsDir: fixtures.defaultResultsDir,
        dump: fixtures.dump,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with both state dump files and results directory", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
    };

    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { open: false },
        resultsDir: fixtures.resultsDir,
        dump: expect.any(Object),
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      output: "foo",
      name: "bar",
    };

    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, [
      "generate",
      "--output",
      fixtures.output,
      "--report-name",
      fixtures.name,
      fixtures.resultsDir,
    ]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: fixtures.output,
      name: fixtures.name,
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { open: false },
        resultsDir: fixtures.resultsDir,
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
    };

    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { open: false },
        resultsDir: fixtures.resultsDir,
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should pass config to generate function", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      configPath: join(".", "custom-config.js"),
      output: "custom-output",
    };

    (readConfig as Mock).mockResolvedValueOnce({ output: fixtures.output, open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--config", fixtures.configPath, fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.configPath, {
      output: undefined,
      name: undefined,
      open: undefined,
      port: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { output: fixtures.output, open: false },
        resultsDir: fixtures.resultsDir,
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should propagate errors from generate function", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
    };

    const error = new Error("Generate failed");
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockRejectedValue(error);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;

    await expect(command.execute()).rejects.toThrow("Generate failed");
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call serve when open flag is true", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
      output: "allure-report",
    };

    (readConfig as Mock).mockResolvedValue({ output: fixtures.output, open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.open = true;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { output: fixtures.output, open: true },
        resultsDir: fixtures.resultsDir,
        dump: expect.any(Object),
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: fixtures.output,
        open: true,
      }),
    );
  });

  it("should pass port to serve when open flag is true and port is specified", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
      output: "allure-report",
      port: "8080",
    };

    (readConfig as Mock).mockResolvedValue({ output: fixtures.output, open: true, port: fixtures.port });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.open = true;
    command.port = fixtures.port;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        config: { output: fixtures.output, open: true, port: fixtures.port },
        resultsDir: fixtures.resultsDir,
        dump: expect.any(Object),
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 8080,
        servePath: fixtures.output,
        open: true,
      }),
    );
  });

  it("should not call serve when open flag is false", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
      output: "allure-report",
    };

    (readConfig as Mock).mockResolvedValue({ output: fixtures.output, open: false });
    (generate as Mock).mockResolvedValue(undefined);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.open = false;

    await command.execute();

    expect(generate).toHaveBeenCalled();
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function when open is true", async () => {
    const fixtures = {
      cwd: ".",
      resultsDir: join(".", "allure-results"),
      output: "allure-report",
    };

    const error = new Error("Serve failed");
    (readConfig as Mock).mockResolvedValue({ output: fixtures.output, open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockRejectedValue(error);

    const command = new GenerateCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.open = true;

    await expect(command.execute()).rejects.toThrow("Serve failed");
    expect(generate).toHaveBeenCalled();
  });
});
