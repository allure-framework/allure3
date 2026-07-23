import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { generate } from "../../src/commands/commons/generate.js";
import { GenerateCommand } from "../../src/commands/generate.js";

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
  await story("generate");
  await label("coverage", "cli-commands");
  vi.clearAllMocks();
});

describe("generate command", () => {
  it("should call generate with correct parameters when results directory is provided", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "allure-report", open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--cwd", "foo", "bar"]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "foo",
        config: { output: "allure-report", open: false },
        resultsDir: ["bar"],
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with empty array when resultsDir not provided", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate"]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: [],
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should pass quarantine override to readConfig", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--quarantine", "quarantine.json", "baz"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: "quarantine.json",
    });
  });

  it("should call generate with dump files when provided", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--dump", "dump.zip", "--dump", "dump.zip"]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        dump: ["dump.zip", "dump.zip"],
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call generate with both state dump files and results directory", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--dump", "dump.zip", "--dump", "dump.zip", "./allure-results"]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { open: false },
        resultsDir: ["./allure-results"],
        dump: ["dump.zip", "dump.zip"],
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--output", "foo", "--report-name", "bar", "baz"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: "bar",
      output: "foo",
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { open: false },
        resultsDir: ["baz"],
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "foo"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { open: false },
        resultsDir: ["foo"],
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should pass config to generate function", async () => {
    (readConfig as Mock).mockResolvedValueOnce({ output: "foo", open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--config", "bar.js", "baz"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), "bar.js", {
      name: undefined,
      output: undefined,
      open: undefined,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        config: { output: "foo", open: false },
        resultsDir: ["baz"],
        dump: undefined,
      }),
    );
    expect(serve).not.toHaveBeenCalled();
  });

  it("should propagate errors from generate function", async () => {
    const error = new Error("Generate failed");
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockRejectedValue(error);

    const code = await run(GenerateCommand, ["generate", "foo"]);

    expect(code).not.toBe(0);
    expect(serve).not.toHaveBeenCalled();
  });

  it("should call serve when open flag is true", async () => {
    (readConfig as Mock).mockResolvedValue({ output: "foo", open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--open", "bar"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      open: true,
      port: undefined,
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { output: "foo", open: true },
        resultsDir: ["bar"],
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: undefined,
        servePath: "foo",
        open: true,
      }),
    );
  });

  it("should pass port to serve when open flag is true and port is specified", async () => {
    (readConfig as Mock).mockResolvedValue({
      output: "foo",
      open: true,
      port: 10202,
    });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--open", "--port", "10201", "bar"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      open: true,
      port: "10201",
      hideLabels: undefined,
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { output: "foo", open: true, port: 10202 },
        resultsDir: ["bar"],
      }),
    );
    expect(serve).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 10202,
        servePath: "foo",
        open: true,
      }),
    );
  });

  it("should not call serve when not open flag is passed", async () => {
    (readConfig as Mock).mockResolvedValue({ open: false });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "foo"]);

    expect(generate).toHaveBeenCalled();
    expect(serve).not.toHaveBeenCalled();
  });

  it("should handle errors from serve function when open is true", async () => {
    const error = new Error("Serve failed");
    (readConfig as Mock).mockResolvedValue({ open: true });
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockRejectedValue(error);

    const code = await run(GenerateCommand, ["generate", "--open", "foo"]);

    expect(code).not.toBe(0);
    expect(generate).toHaveBeenCalled();
  });

  it("should pass hideLabels override to readConfig and use normalized config", async () => {
    (readConfig as Mock).mockResolvedValue({
      open: false,
      hideLabels: ["foo", "bar"],
    });
    (generate as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "--hide-labels", "baz", "--hide-labels", "qux", "qut"]);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: undefined,
      open: undefined,
      port: undefined,
      hideLabels: ["baz", "qux"],
      historyLimit: undefined,
      knownIssuesPath: undefined,
      quarantinePath: undefined,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          hideLabels: ["foo", "bar"],
        }),
      }),
    );
  });

  it("should support multiple resultsDir", async () => {
    (readConfig as Mock).mockResolvedValue({});
    (generate as Mock).mockResolvedValue(undefined);
    (serve as Mock).mockResolvedValue(undefined);

    await run(GenerateCommand, ["generate", "foo", "bar"]);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        resultsDir: ["foo", "bar"],
      }),
    );
  });
});
