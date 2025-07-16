import { AllureReport, readConfig } from "@allurereport/core";
import SlackPlugin from "@allurereport/plugin-slack";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { SlackCommand } from "../../src/commands/slack.js";

const fixtures = {
  token: "token",
  channel: "channel",
  resultsDir: "foo/bar/allure-results",
  config: "./custom/allurerc.mjs",
  cwd: ".",
};

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
  it("should initialize allure report with provided plugin options when config exists", async () => {
    (readConfig as Mock).mockResolvedValueOnce({
      plugins: [
        {
          id: "my-slack-plugin",
          enabled: true,
          options: {
            token: fixtures.token,
            channel: fixtures.channel,
          },
          plugin: new SlackPlugin({
            token: fixtures.token,
            channel: fixtures.channel,
          }),
        },
      ],
    });

    const command = new SlackCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = [fixtures.resultsDir];
    command.token = fixtures.token;
    command.channel = fixtures.channel;

    await command.execute();

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-slack-plugin",
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

  it("should initialize allure report with provided command line options", async () => {
    const command = new SlackCommand();

    command.cwd = fixtures.cwd;
    command.resultsDir = [fixtures.resultsDir];
    command.token = fixtures.token;
    command.channel = fixtures.channel;
    command.config = fixtures.config;

    await command.execute();

    expect(readConfig).toHaveBeenCalledTimes(1);
    expect(readConfig).toHaveBeenCalledWith(expect.any(String), fixtures.config);
    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "slack",
            enabled: true,
            options: expect.objectContaining({
              token: fixtures.token,
              channel: fixtures.channel,
            }),
            plugin: expect.any(SlackPlugin),
          }),
        ]),
      }),
    );
  });
});
