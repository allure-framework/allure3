import { AllureReport, readConfig } from "@allurereport/core";
import SlackPlugin from "@allurereport/plugin-slack";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { SlackCommandAction } from "../../src/commands/slack.js";

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
    const fixtures = {
      token: "token",
      channel: "channel",
      resultsDir: "foo/bar/allure-results",
    };

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

    await SlackCommandAction(fixtures.resultsDir, {
      token: fixtures.token,
      channel: fixtures.channel,
    });

    expect(AllureReport).toHaveBeenCalledTimes(1);
    expect(AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "my-slack-plugin",
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

  it("should initialize allure report with provided command line options", async () => {
    const fixtures = {
      token: "token",
      channel: "channel",
      resultsDir: "foo/bar/allure-results",
      config: "./custom/allurerc.mjs",
    };

    await SlackCommandAction(fixtures.resultsDir, {
      token: fixtures.token,
      channel: fixtures.channel,
      config: fixtures.config,
    });

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
