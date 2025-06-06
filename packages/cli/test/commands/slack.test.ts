import * as core from "@allurereport/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlackCommandAction } from "../../src/commands/slack.js";

vi.spyOn(core, "resolveConfig");
vi.mock("@allurereport/core", async (importOriginal) => {
  const utils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    AllureReport: utils.AllureReportMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slack command", () => {
  it("should initialize allure report with a provided plugin options", async () => {
    const fixtures = {
      token: "token",
      channel: "channel",
      resultsDir: "foo/bar/allure-results",
    };

    await SlackCommandAction(fixtures.resultsDir, {
      token: fixtures.token,
      channel: fixtures.channel,
    });

    expect(core.resolveConfig).toHaveBeenCalledTimes(1);
    expect(core.resolveConfig).toHaveBeenCalledWith({
      plugins: expect.objectContaining({
        "@allurereport/plugin-slack": {
          options: {
            token: fixtures.token,
            channel: fixtures.channel,
          },
        },
      }),
    });
    expect(core.AllureReport).toHaveBeenCalledTimes(1);
    expect(core.AllureReport).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "plugin-slack",
            enabled: true,
            options: {
              token: fixtures.token,
              channel: fixtures.channel,
            },
          }),
        ]),
      }),
    );
  });
});
