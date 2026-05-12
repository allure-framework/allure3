import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exit } from "node:process";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
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
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("glob", () => ({
  glob: vi.fn(),
}));
vi.mock("@allurereport/core", async () => {
  return {
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

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("open");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

describe("open command", () => {
  it("should open existing default dir when no input and config output are provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "bar"]);

    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: join("bar", "allure-report"),
    });
    expect(readConfig).toHaveBeenCalledWith("bar", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: join("bar", "allure-report"),
        open: true,
      }),
    );
  });

  it("should open existing configured dir when no input is provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValueOnce({ output: "bar" });
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "baz"]);

    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: join("baz", "bar"),
    });
    expect(readConfig).toHaveBeenCalledWith("baz", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: join("baz", "bar"),
        open: true,
      }),
    );
  });

  it("should generate report in temp directory and serve when no summary files found", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "qux", "qut"]);

    expect(mkdtemp).toHaveBeenCalledWith(join("foo", "allure-report-"));
    expect(readConfig).toHaveBeenCalledWith("qux", undefined, {
      port: undefined,
      output: "bar",
      hideLabels: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "qux",
        config: { output: "baz" },
        resultsDir: ["qut"],
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: "baz",
        open: true,
      }),
    );
  });

  it("should fail when no input provided and configured output not exists", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(false);
    (readConfig as Mock).mockResolvedValueOnce({ output: "foo" });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "bar"]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`A report doesn't exist in ${join("bar", "foo")} and no input was provided to generate.`),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should fail when no input provided and default output not exists", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(false);
    (readConfig as Mock).mockResolvedValueOnce({});
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "foo"]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${join("foo", "allure-report")} and no input was provided to generate.`,
      ),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should fail when no input provided and no report in configured output", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValueOnce({ output: "foo" });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "bar"]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`A report doesn't exist in ${join("bar", "foo")} and no input was provided to generate.`),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should fail when no input provided and no report in default output", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValueOnce({});
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "foo"]);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${join("foo", "allure-report")} and no input was provided to generate.`,
      ),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should serve existing report when summary.json files are found", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "bar", "baz"]);

    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: join("bar", "baz"),
    });
    expect(readConfig).toHaveBeenCalledWith("bar", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: join("bar", "baz"),
        open: true,
      }),
    );
  });

  it("should generate report when target directory does not exist", async () => {
    (existsSync as Mock).mockReturnValue(false);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "qux", "qut"]);

    expect(glob).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: ["qut"],
        cwd: "qux",
        config: expect.objectContaining({
          output: "baz",
        }),
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        servePath: "baz",
        open: true,
      }),
    );
  });

  it("should serve with custom port when specified", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: "10201" });
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "bar", "--port", "10202", "baz"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: "10202",
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 10201,
        servePath: join("bar", "baz"),
        open: true,
      }),
    );
  });

  it("should use custom config file when provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "qux", "--config", "qut", "quc"]);

    expect(readConfig).toHaveBeenCalledWith("qux", "qut", {
      port: undefined,
      output: "bar",
      hideLabels: undefined,
    });
  });

  it("should use process cwd if no --cwd provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "qux"]);

    expect(readConfig).toHaveBeenCalledWith(process.cwd(), undefined, expect.any(Object));
    expect(glob).toHaveBeenCalledWith(
      join("**", "summary.json"),
      expect.objectContaining({
        cwd: join(process.cwd(), "qux"),
      }),
    );
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: process.cwd(),
        resultsDir: ["qux"],
      }),
    );
  });

  it("should check for summary.json in target directory", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "qux", "qut"]);

    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: join("qux", "qut"),
    });
  });

  it("should create temp directory with mkdtemp pattern", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--cwd", "qux", "qut"]);

    expect(mkdtemp).toHaveBeenCalledWith(join("foo", "allure-report-"));
    expect(readConfig).toHaveBeenCalledWith("qux", undefined, {
      port: undefined,
      output: "bar",
      hideLabels: undefined,
    });
  });

  it("should pass hideLabels override when generating a temporary report", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({
      output: "baz",
      hideLabels: ["qut", "quc"],
    });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "--hide-labels", "quz", "--hide-labels", "qur", "qre"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: undefined,
      output: "bar",
      hideLabels: ["quz", "qur"],
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          hideLabels: ["qut", "quc"],
        }),
      }),
    );
  });

  it("should generate if more than one resultsDir provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(OpenCommand, ["open", "foo", "bar"]);

    expect(existsSync).toHaveBeenCalledTimes(0);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: ["foo", "bar"],
      }),
    );
    expect(serve).toHaveBeenCalledOnce();
  });
});
