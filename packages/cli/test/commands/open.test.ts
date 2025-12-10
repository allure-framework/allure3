import { readConfig } from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { run } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenCommand } from "../../src/commands/open.js";

const fixtures = {
  reportDir: "custom-report",
  output: "./custom/output/path",
  port: "8080",
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    readConfig: vi.fn().mockResolvedValue({
      output: "allure-report",
    }),
  };
});

vi.mock("@allurereport/static-server", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    serve: vi.fn().mockResolvedValue({
      url: "http://localhost:8080",
      port: 8080,
      stop: vi.fn(),
      reload: vi.fn(),
      open: vi.fn(),
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("open command", () => {
  it("should serve report with the default options", async () => {
    const command = new OpenCommand();

    command.cwd = fixtures.cwd;
    command.live = undefined;
    command.config = undefined;
    command.reportDir = undefined;
    command.port = undefined;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, undefined, { output: undefined });
    expect(serve).toHaveBeenCalledTimes(1);
    expect(serve).toHaveBeenCalledWith({
      port: undefined,
      servePath: "allure-report",
      live: false,
      open: true,
    });
  });

  it("should serve with custom options", async () => {
    const command = new OpenCommand();

    command.cwd = fixtures.cwd;
    command.reportDir = fixtures.reportDir;
    command.port = fixtures.port;
    command.live = true;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(fixtures.cwd, fixtures.config, { output: fixtures.reportDir });
    expect(serve).toHaveBeenCalledTimes(1);
    expect(serve).toHaveBeenCalledWith({
      port: parseInt(fixtures.port, 10),
      servePath: "allure-report",
      live: true,
      open: true,
    });
  });

  it("should prefer CLI arguments over config and defaults", async () => {
    await run(OpenCommand, ["open", "foo"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(undefined, undefined, {
      output: "foo",
    });
  });

  it("should not overwrite readConfig values if no CLI arguments provided", async () => {
    await run(OpenCommand, ["open"]);

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(undefined, undefined, {
      output: undefined,
    });
  });
});
