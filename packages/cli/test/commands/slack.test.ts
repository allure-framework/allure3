import { AllureReport, readConfig } from "@allurereport/core";
import SlackPlugin from "@allurereport/plugin-slack";
import * as console from "node:console";
import { existsSync } from "node:fs";
import { exit } from "node:process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { SlackCommand } from "../../src/commands/slack.js";

const fixtures = {
  token: "token",
  channel: "channel",
  resultsDir: "foo/bar/allure-results",
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: vi.fn(),
}));
vi.mock("@allurereport/core", async (importOriginal) => {
  const { AllureReportMock } = await import("../utils.js");
  return {
    ...(await importOriginal()),
    readConfig: vi.fn(),
    AllureReport: AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slack command", () => {
  it("should exit with code 1 when resultsDir doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(false);

    const command = new SlackCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;
    command.token = fixtures.token;
    command.channel = fixtures.channel;

    await command.execute();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`The given test results directory doesn't exist: ${fixtures.resultsDir}`),
    );
    expect(exit).toHaveBeenCalledWith(1);
    expect(AllureReport).not.toHaveBeenCalled();
  });

  it("should initialize allure report with default plugin options when config doesn't exist", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [],
    });

    const command = new SlackCommand();

    command.cwd = ".";
    command.resultsDir = fixtures.resultsDir;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith({
      plugins: expect.arrayContaining([
        expect.objectContaining({
          id: "slack",
          enabled: true,
          plugin: expect.any(SlackPlugin),
        }),
      ]),
    });
  });

  it("should initialize allure report with provided plugin options when config exists", async () => {
    (existsSync as Mock).mockReturnValueOnce(true);
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-slack-plugin1",
          enabled: true,
          options: {},
          plugin: new SlackPlugin({}),
        },
        {
          id: "my-slack-plugin2",
          enabled: true,
          options: {},
          plugin: new SlackPlugin({}),
        },
      ],
    });

    const command = new SlackCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = fixtures.resultsDir;
    command.token = fixtures.token;
    command.channel = fixtures.channel;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "slack",
            enabled: true,
            options: {
              token: fixtures.token,
              channel: fixtures.channel,
            },
            plugin: expect.any(SlackPlugin),
          }),
        ]),
      }),
    );
  });
});
