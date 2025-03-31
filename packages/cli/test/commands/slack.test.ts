import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureReportMock } from "../utils.js";

const core = await import("@allurereport/core");
const { SlackCommandAction } = await import("../../src/commands/slack.js");

vi.spyOn(core, "resolveConfig");
vi.mock("@allurereport/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    AllureReport: AllureReportMock,
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
        history: [],
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
