import { PassThrough } from "node:stream";

import type { AllureStore, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { ProgressPlugin } from "../src/plugin.js";

beforeEach(async () => {
  await story("index");
});

const createTtyStream = () => {
  const stream = new PassThrough() as unknown as PassThrough & { isTTY: boolean; columns: number };

  stream.isTTY = true;
  stream.columns = 80;

  let output = "";

  stream.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { stream, getOutput: () => output };
};

const createStore = () => ({ testsStatistic: async () => ({ total: 1 }) }) as unknown as AllureStore;

const createRealtime = () => {
  let listener: (() => Promise<void>) | undefined;

  return {
    realtime: {
      onTestResults: (callback: () => Promise<void>) => {
        listener = callback;
        return () => {};
      },
    } as unknown as RealtimeSubscriber,
    emitTestResults: async () => {
      await listener?.();
    },
  };
};

describe("ProgressPlugin", () => {
  it("appends a new line per render in preserve mode instead of overwriting the previous one", async () => {
    const { stream, getOutput } = createTtyStream();
    const { realtime, emitTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, preserve: true, minRenderIntervalMs: 0 });

    await plugin.start({} as PluginContext, createStore(), realtime);
    await emitTestResults();
    await emitTestResults();
    await plugin.done({} as PluginContext, createStore());

    const lines = getOutput().split("\n").filter(Boolean);

    expect(lines).toHaveLength(3);
  });

  it("redraws a single line in place when preserve mode is off", async () => {
    const { stream, getOutput } = createTtyStream();
    const { realtime, emitTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 0 });

    await plugin.start({} as PluginContext, createStore(), realtime);
    await emitTestResults();
    await emitTestResults();
    await plugin.done({} as PluginContext, createStore());

    const lines = getOutput().split("\n").filter(Boolean);

    expect(lines).toHaveLength(1);
  });
});
