import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SlackPlugin } from "../src/plugin.js";

const createStore = (): AllureStore =>
  ({
    testsStatistic: vi.fn().mockResolvedValue({
      total: 2,
      failed: 1,
      broken: 0,
      passed: 1,
      skipped: 0,
      unknown: 0,
    }),
    failedTestResults: vi
      .fn()
      .mockResolvedValue([
        { id: "failed", name: "failed", fullName: "example failed test", status: "failed" } as TestResult,
      ]),
  }) as unknown as AllureStore;

const context = {} as PluginContext;

beforeEach(async () => {
  await story("index");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("SlackPlugin", () => {
  it("posts notifications using an incoming webhook", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    await new SlackPlugin({ webhook: "https://hooks.slack.com/services/example" }).done(context, createStore());

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/example",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
      }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toEqual({
      blocks: expect.arrayContaining([expect.objectContaining({ type: "rich_text" })]),
    });
  });

  it("uses the webhook from the environment", async () => {
    vi.stubEnv("ALLURE_SLACK_WEBHOOK", "https://hooks.slack.com/services/environment");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    await new SlackPlugin().done(context, createStore());

    expect(fetchMock).toHaveBeenCalledWith("https://hooks.slack.com/services/environment", expect.any(Object));
  });

  it("reports incoming webhook errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid_payload", { status: 400 }));

    await expect(
      new SlackPlugin({ webhook: "https://hooks.slack.com/services/example" }).done(context, createStore()),
    ).rejects.toThrow("slack error: invalid_payload");
  });

  it("continues to support bot tokens and channels", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } }),
      );

    await new SlackPlugin({ token: "token", channel: "channel" }).done(context, createStore());

    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json;charset=utf-8",
          "Authorization": "Bearer token",
        },
      }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request?.body as string)).toEqual(
      expect.objectContaining({
        channel: "channel",
        blocks: expect.any(Array),
      }),
    );
  });
});
