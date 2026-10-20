import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { glob } from "glob";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { generate } from "../../src/commands/commons/generate.js";
import { ServeCommand } from "../../src/commands/serve.js";
import { notifySignals } from "../../src/utils/signals.js";

vi.mock("../../src/utils/signals.js", async (importOriginal) => ({
  ...(await importOriginal()),
  notifySignals: vi.fn(),
}));

let shutdown: AbortController;

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

const mockServe = () => {
  const stop = vi.fn().mockResolvedValue(undefined);
  return {
    serve: (serve as Mock).mockImplementation(() => {
      shutdown.abort();
      return { stop };
    }),
    stop,
  };
};

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("open");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
  shutdown = new AbortController();
  vi.mocked(notifySignals).mockReturnValue({
    signal: shutdown.signal,
    info: () => ({ signal: "SIGINT", code: 130, receivedAt: 0, deadline: 0 }),
    dispose: vi.fn(),
  });
});

describe("serve command", () => {
  it("should stop the server on CTRL+C after report generation", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    vi.mocked(tmpdir).mockReturnValue("tmp");
    vi.mocked(mkdtemp).mockResolvedValue("temporary-report");
    (readConfig as Mock).mockResolvedValue({ output: "temporary-report" });
    const { stop } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "results"]);

    expect(exitCode).toBe(0);
    expect(stop).toHaveBeenCalledOnce();
    expect(rm).toHaveBeenCalledWith("temporary-report", { recursive: true, force: true });
  });

  it("should stop the server on CTRL+C after serving existing report", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["summary.json"]);
    vi.mocked(tmpdir).mockReturnValue("tmp");
    (readConfig as Mock).mockResolvedValue({ output: "existing-report" });
    const { stop } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "results"]);

    expect(exitCode).toBe(0);
    expect(stop).toHaveBeenCalledOnce();
    expect(rm).not.toHaveBeenCalled();
  });

  it("should serve existing default dir when no input and config output are provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "bar"]);

    expect(exitCode).toBe(0);
    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: resolve("bar", "allure-report"),
    });
    expect(readConfig).toHaveBeenCalledWith("bar", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: resolve("bar", "allure-report"),
        open: false,
      }),
    );
  });

  it("should serve existing configured dir when no input is provided", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValueOnce({ output: "bar" });
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "baz"]);

    expect(exitCode).toBe(0);
    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: resolve("baz", "bar"),
    });
    expect(readConfig).toHaveBeenCalledWith("baz", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: resolve("baz", "bar"),
        open: false,
      }),
    );
  });

  it("should serve existing report on the host from the config", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ host: "0.0.0.0" });
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--host", "0.0.0.0"]);
    expect(exitCode).toBe(0);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: undefined,
      host: "0.0.0.0",
    });
    expect(serve).toHaveBeenCalledWith(expect.objectContaining({ host: "0.0.0.0", open: false }));
  });

  it("should generate report in temp directory and serve when no summary files found", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (glob as unknown as Mock).mockResolvedValue([]);
    (generate as Mock).mockResolvedValue(undefined);
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "qux", "qut"]);

    expect(exitCode).toBe(0);
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
        open: false,
      }),
    );
  });

  it("should fail when no input provided and configured output not exists", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(false);
    (readConfig as Mock).mockResolvedValueOnce({ output: "foo" });
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "bar"]);

    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${resolve("bar", "foo")} and no input was provided to generate.`,
      ),
    );
  });

  it("should fail when no input provided and default output not exists", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(false);
    (readConfig as Mock).mockResolvedValueOnce({});
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "foo"]);

    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${resolve("foo", "allure-report")} and no input was provided to generate.`,
      ),
    );
  });

  it("should fail when no input provided and no report in configured output", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValueOnce({ output: "foo" });
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "bar"]);

    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${resolve("bar", "foo")} and no input was provided to generate.`,
      ),
    );
  });

  it("should fail when no input provided and no report in default output", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValueOnce({});
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "foo"]);

    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `A report doesn't exist in ${resolve("foo", "allure-report")} and no input was provided to generate.`,
      ),
    );
  });

  it("should serve existing report when summary.json files are found", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: undefined });
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "bar", "baz"]);

    expect(exitCode).toBe(0);
    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: resolve("bar", "baz"),
    });
    expect(readConfig).toHaveBeenCalledWith("bar", undefined, {
      port: undefined,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: resolve("bar", "baz"),
        open: false,
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
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "qux", "qut"]);

    expect(exitCode).toBe(0);
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
        open: false,
      }),
    );
  });

  it("should serve with custom port when specified", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (glob as unknown as Mock).mockResolvedValue(["foo"]);
    (readConfig as Mock).mockResolvedValue({ port: "10201" });
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "bar", "--port", "10202", "baz"]);

    expect(exitCode).toBe(0);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      port: "10202",
    });
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 10201,
        servePath: resolve("bar", "baz"),
        open: false,
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
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "qux", "--config", "qut", "quc"]);

    expect(exitCode).toBe(0);
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
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "qux"]);

    expect(exitCode).toBe(0);
    expect(readConfig).toHaveBeenCalledWith(process.cwd(), undefined, expect.any(Object));
    expect(glob).toHaveBeenCalledWith(
      join("**", "summary.json"),
      expect.objectContaining({
        cwd: resolve(process.cwd(), "qux"),
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
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "qux", "qut"]);

    expect(exitCode).toBe(0);
    expect(glob).toHaveBeenCalledWith(join("**", "summary.json"), {
      nodir: true,
      absolute: true,
      dot: true,
      windowsPathsNoEscape: true,
      cwd: resolve("qux", "qut"),
    });
  });

  it("should create temp directory with mkdtemp pattern", async () => {
    (existsSync as Mock).mockReturnValue(true);
    (tmpdir as Mock).mockReturnValue("foo");
    (mkdtemp as Mock).mockResolvedValue("bar");
    (glob as unknown as Mock).mockResolvedValue([]);
    (readConfig as Mock).mockResolvedValue({ output: "baz" });
    (generate as Mock).mockResolvedValue(undefined);
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--cwd", "qux", "qut"]);

    expect(exitCode).toBe(0);
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
    mockServe();

    const exitCode = await run(ServeCommand, ["serve", "--hide-labels", "quz", "--hide-labels", "qur", "qre"]);

    expect(exitCode).toBe(0);
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
    const { serve } = mockServe();

    const exitCode = await run(ServeCommand, ["serve", "foo", "bar"]);

    expect(exitCode).toBe(0);
    expect(existsSync).toHaveBeenCalledTimes(0);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: ["foo", "bar"],
      }),
    );
    expect(serve).toHaveBeenCalledOnce();
  });

  describe("with --open", () => {
    it("should open a generated report", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      (glob as unknown as Mock).mockResolvedValue([]);
      vi.mocked(tmpdir).mockReturnValue("tmp");
      vi.mocked(mkdtemp).mockResolvedValue("temporary-report");
      (readConfig as Mock).mockResolvedValue({ output: "temporary-report" });
      const { serve } = mockServe();

      const exitCode = await run(ServeCommand, ["serve", "--open", "results"]);

      expect(exitCode).toBe(0);
      expect(serve).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
    });

    it("should open an existing report", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      (glob as unknown as Mock).mockResolvedValue(["summary.json"]);
      vi.mocked(tmpdir).mockReturnValue("tmp");
      (readConfig as Mock).mockResolvedValue({ output: "existing-report" });
      const { serve } = mockServe();

      const exitCode = await run(ServeCommand, ["serve", "--open", "results"]);

      expect(exitCode).toBe(0);
      expect(serve).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
    });
  });
});
