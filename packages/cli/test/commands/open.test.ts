import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { glob } from "glob";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/commands/commons/generate.js";
import { OpenCommand } from "../../src/commands/open.js";

vi.mock("node:fs", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    existsSync: vi.fn(),
  };
});
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}));
vi.mock("node:os", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    tmpdir: vi.fn(),
  };
});
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
      resultsDir: "allure-report",
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(mkdtemp).toHaveBeenCalledWith(join("/tmp", "allure-report-"));
    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
      output: fixtures.tmpDir,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: ".",
        config: { output: fixtures.tmpDir },
        resultsDir: join(".", fixtures.resultsDir),
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: fixtures.tmpDir,
        open: true,
      }),
    );
  });

  it("should serve existing report when summary.json files are found", async () => {
    const fixtures = {
      resultsDir: "allure-report",
    };

    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([join(".", fixtures.resultsDir, "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(glob).toHaveBeenCalledWith(join(".", fixtures.resultsDir, "**", "summary.json"), {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: ".",
    });
    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: join(".", fixtures.resultsDir),
        open: true,
      }),
    );
  });

  it("should generate report when target directory does not exist", async () => {
    const fixtures = {
      resultsDir: "allure-report",
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(false);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(existsSync).toHaveBeenCalledWith(join(".", fixtures.resultsDir));
    expect(glob).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        servePath: fixtures.tmpDir,
        open: true,
      }),
    );
  });

  it("should serve with custom port when specified", async () => {
    const fixtures = {
      resultsDir: "report",
      port: "8080",
    };

    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([join(".", fixtures.resultsDir, "summary.json")]);
    (readConfig as Mock).mockResolvedValue({ port: fixtures.port });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.port = fixtures.port;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: fixtures.port,
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 8080,
        servePath: join(".", fixtures.resultsDir),
        open: true,
      }),
    );
  });

  it("should use custom config file when provided", async () => {
    const fixtures = {
      resultsDir: "allure-report",
      configPath: join(".", "custom", "allurerc.mjs"),
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.config = fixtures.configPath;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", fixtures.configPath, {
      port: expect.any(Object),
      output: fixtures.tmpDir,
    });
  });

  it("should prefer CLI arguments over config", async () => {
    const fixtures = {
      resultsDir: "allure-report",
      port: "3000",
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir, port: fixtures.port });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--port", fixtures.port, fixtures.resultsDir]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: fixtures.port,
      output: fixtures.tmpDir,
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 3000,
        servePath: fixtures.tmpDir,
        open: true,
      }),
    );
  });

  it("should use cwd when provided", async () => {
    const fixtures = {
      cwd: join("/", "custom", "cwd"),
      resultsDir: "allure-report",
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, expect.any(Object), {
      port: expect.any(Object),
      output: fixtures.tmpDir,
    });
    expect(glob).toHaveBeenCalledWith(
      join(fixtures.cwd, fixtures.resultsDir, "**", "summary.json"),
      expect.objectContaining({
        cwd: fixtures.cwd,
      }),
    );
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: fixtures.cwd,
        resultsDir: join(fixtures.cwd, fixtures.resultsDir),
      }),
    );
  });

  it("should check for summary.json in target directory", async () => {
    const fixtures = {
      resultsDir: "my-results",
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(glob).toHaveBeenCalledWith(join(".", fixtures.resultsDir, "**", "summary.json"), {
      mark: true,
      nodir: false,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: ".",
    });
  });

  it("should use default resultsDir when not provided", async () => {
    const fixtures = {
      tmpDir: "/tmp/allure-report-abc123",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = undefined;

    await command.execute();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: join(".", "allure-report"),
      }),
    );
  });

  it("should create temp directory with mkdtemp pattern", async () => {
    const fixtures = {
      resultsDir: "allure-report",
      tmpDir: "/tmp/allure-report-xyz789",
    };

    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("/tmp");
    (mkdtemp as Mock).mockResolvedValue(fixtures.tmpDir);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: fixtures.tmpDir });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(mkdtemp).toHaveBeenCalledWith(join("/tmp", "allure-report-"));
    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
      output: fixtures.tmpDir,
    });
  });
});
