import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { glob } from "glob";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/commands/commons/generate.js";
import { OpenCommand } from "../../src/commands/open.js";

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));
vi.mock("glob", () => ({
  glob: vi.fn(),
}));
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
  it("should generate report in temp directory and serve when no summary files found", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: ".",
        config: { output: join(".allure", fixtures.uuid) },
        resultsDir: fixtures.resultsDir,
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: join(".allure", fixtures.uuid),
        open: true,
      }),
    );
  });

  it("should serve existing report when summary.json files are found", async () => {
    const fixtures = {
      resultsDir: "allure-results",
    };

    (glob as unknown as Mock).mockResolvedValue(["allure-results/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.resultsDir });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
      output: fixtures.resultsDir,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: fixtures.resultsDir,
        open: true,
      }),
    );
  });

  it("should handle glob patterns in resultsDir", async () => {
    const fixtures = {
      resultsDir: "./**/allure-results",
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(glob).toHaveBeenCalledWith(
      fixtures.resultsDir,
      expect.objectContaining({
        mark: true,
        nodir: false,
        absolute: true,
        dot: true,
        windowsPathsNoEscape: true,
        cwd: ".",
      }),
    );
    expect(generate).toHaveBeenCalled();
  });

  it("should serve with custom port when specified", async () => {
    const fixtures = {
      resultsDir: join(".", "report"),
      port: "8080",
    };

    (glob as unknown as Mock).mockResolvedValue([join(".", "report", "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.resultsDir, port: fixtures.port });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.port = fixtures.port;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: fixtures.port,
      output: fixtures.resultsDir,
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 8080,
        servePath: fixtures.resultsDir,
        open: true,
      }),
    );
  });

  it("should use custom config file when provided", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      configPath: join(".", "custom", "allurerc.mjs"),
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.configPath;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", fixtures.configPath, {
      port: expect.any(Object),
      output: join(".", ".allure", fixtures.uuid),
    });
  });

  it("should handle errors from generate function", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      uuid: "0123",
    };

    const error = new Error("Generate failed");
    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (generate as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await expect(command.execute()).rejects.toThrow("Generate failed");
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function", async () => {
    const fixtures = {
      resultsDir: join(".", "report"),
    };

    const error = new Error("Serve failed");
    (glob as unknown as Mock).mockResolvedValue([join(".", "report", "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.resultsDir });
    (serve as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await expect(command.execute()).rejects.toThrow("Serve failed");
    expect(generate).not.toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config", async () => {
    const fixtures = {
      resultsDir: join(".", "allure-results"),
      port: "3000",
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid), port: fixtures.port });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--port", fixtures.port, fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: fixtures.port,
      output: expect.stringContaining(join(".allure", fixtures.uuid)),
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        servePath: expect.stringContaining(join(".allure", fixtures.uuid)),
        open: true,
      }),
    );
  });

  it("should use cwd when provided", async () => {
    const fixtures = {
      cwd: join("/", "custom", "cwd"),
      resultsDir: join(".", "allure-results"),
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(fixtures.cwd, ".allure", fixtures.uuid) });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, expect.any(Object), {
      port: expect.any(Object),
      output: join(fixtures.cwd, ".allure", fixtures.uuid),
    });
    expect(glob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cwd: fixtures.cwd,
      }),
    );
  });

  it("should check for summary.json in nested paths when non-glob pattern provided", async () => {
    const fixtures = {
      resultsDir: join(".", "my-results"),
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(glob).toHaveBeenCalledWith(join("my-results", "**", "summary.json"), expect.any(Object));
  });

  it("should use glob pattern directly when wildcards are present", async () => {
    const fixtures = {
      resultsDir: "./test-*-results",
      uuid: "0123",
    };

    (randomUUID as Mock).mockReturnValue(fixtures.uuid);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: join(".allure", fixtures.uuid) });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(glob).toHaveBeenCalledWith(fixtures.resultsDir, expect.any(Object));
  });

  it("should parse port as number when serving", async () => {
    const fixtures = {
      resultsDir: join(".", "report"),
      port: "9000",
    };

    (glob as unknown as Mock).mockResolvedValue([join(".", "report", "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.resultsDir, port: fixtures.port });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.port = fixtures.port;

    await command.execute();

    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 9000,
        servePath: fixtures.resultsDir,
        open: true,
      }),
    );
  });

  it("should handle undefined port gracefully", async () => {
    const fixtures = {
      resultsDir: join(".", "report"),
    };

    (glob as unknown as Mock).mockResolvedValue([join(".", "report", "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.resultsDir, port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: fixtures.resultsDir,
        open: true,
      }),
    );
  });
});
