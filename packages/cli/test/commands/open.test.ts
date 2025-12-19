import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "../../src/commands/commons/generate.js";
import { OpenCommand } from "../../src/commands/open.js";

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
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
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
      output: expect.stringMatching(/\.allure\/test-uuid-1234$/),
    });
    expect(generate).toHaveBeenCalledWith({
      cwd: ".",
      config: { output: expect.stringMatching(/\.allure\/test-uuid-1234$/) },
      resultsDir: "./allure-results",
    });
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: expect.stringMatching(/\.allure\/test-uuid-1234$/),
      open: true,
    });
  });

  it("should serve existing report when summary.json files are found", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./allure-results/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: "./allure-results" });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: expect.any(Object),
      output: "./allure-results",
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: "./allure-results",
      open: true,
    });
  });

  it("should handle glob patterns in resultsDir", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./**/allure-results";

    await command.execute();

    expect(glob).toHaveBeenCalledWith(
      "./**/allure-results",
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
    (glob as unknown as Mock).mockResolvedValue(["./report/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: "./report", port: "8080" });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./report";
    command.port = "8080";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", expect.any(Object), {
      port: "8080",
      output: "./report",
    });
    expect(serve).toHaveBeenCalledWith({
      port: 8080,
      servePath: "./report",
      open: true,
    });
  });

  it("should use custom config file when provided", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";
    command.config = "./custom/allurerc.mjs";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith(".", "./custom/allurerc.mjs", {
      port: expect.any(Object),
      output: expect.stringMatching(/\.allure\/test-uuid-1234$/),
    });
  });

  it("should handle errors from generate function", async () => {
    const error = new Error("Generate failed");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./allure-results";

    await expect(command.execute()).rejects.toThrow("Generate failed");
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function", async () => {
    const error = new Error("Serve failed");
    (glob as unknown as Mock).mockResolvedValue(["./report/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: "./report" });
    (serve as Mock).mockRejectedValue(error);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./report";

    await expect(command.execute()).rejects.toThrow("Serve failed");
    expect(generate).not.toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234", port: "3000" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--port", "3000", "./allure-results"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: "3000",
      output: expect.stringContaining(".allure/test-uuid-1234"),
    });
    expect(serve).toHaveBeenCalledWith({
      port: 3000,
      servePath: expect.stringContaining(".allure/test-uuid-1234"),
      open: true,
    });
  });

  it("should use cwd when provided", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "/custom/cwd/.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = "/custom/cwd";
    command.resultsDir = "./allure-results";

    await command.execute();

    expect(readConfig).toHaveBeenCalledWith("/custom/cwd", expect.any(Object), {
      port: expect.any(Object),
      output: expect.stringMatching(/\.allure\/test-uuid-1234$/),
    });
    expect(glob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cwd: "/custom/cwd",
      }),
    );
  });

  it("should check for summary.json in nested paths when non-glob pattern provided", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./my-results";

    await command.execute();

    expect(glob).toHaveBeenCalledWith("my-results/**/summary.json", expect.any(Object));
  });

  it("should use glob pattern directly when wildcards are present", async () => {
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "./.allure/test-uuid-1234" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./test-*-results";

    await command.execute();

    expect(glob).toHaveBeenCalledWith("./test-*-results", expect.any(Object));
  });

  it("should parse port as number when serving", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./report/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: "./report", port: "9000" });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./report";
    command.port = "9000";

    await command.execute();

    expect(serve).toHaveBeenCalledWith({
      port: 9000,
      servePath: "./report",
      open: true,
    });
  });

  it("should handle undefined port gracefully", async () => {
    (glob as unknown as Mock).mockResolvedValue(["./report/summary.json"]);
    (readConfig as Mock).mockResolvedValue({ output: "./report", port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    const command = new OpenCommand();

    command.cwd = ".";
    command.resultsDir = "./report";

    await command.execute();

    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: "./report",
      open: true,
    });
  });
});
