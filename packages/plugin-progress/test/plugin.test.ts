import console from "node:console";
import { PassThrough } from "node:stream";

import type { AllureStore, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressPlugin } from "../src/plugin.js";
import { Terminal } from "../src/terminal.js";

beforeEach(async () => {
  await story("plugin");
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

type FakeStore = AllureStore & {
  setStatistic: (failed: number, broken: number, passed: number) => void;
  callCount: () => number;
};

const createFakeStore = (delayMs = 0): FakeStore => {
  let failed = 0;
  let broken = 0;
  let passed = 0;
  let calls = 0;

  return {
    setStatistic: (f: number, b: number, p: number) => {
      failed = f;
      broken = b;
      passed = p;
    },
    callCount: () => calls,
    testsStatistic: async () => {
      calls += 1;

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      return { failed, broken, passed, total: failed + broken + passed };
    },
  } as unknown as FakeStore;
};

const createRealtime = (): { realtime: RealtimeSubscriber; fireTestResults: () => void } => {
  let handler: (() => void) | undefined;

  return {
    realtime: {
      onTestResults: (listener: () => void) => {
        handler = listener;
        return () => {
          handler = undefined;
        };
      },
    } as unknown as RealtimeSubscriber,
    fireTestResults: () => handler?.(),
  };
};

describe("ProgressPlugin", () => {
  it("never renders concurrently even when the store is slow", async () => {
    const { stream } = createTtyStream();
    const store = createFakeStore(40);
    const { realtime, fireTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 10 });

    let concurrent = 0;
    let maxConcurrent = 0;
    const originalTestsStatistic = store.testsStatistic;

    store.testsStatistic = async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);

      const result = await originalTestsStatistic();

      concurrent -= 1;

      return result;
    };

    await plugin.start({} as PluginContext, store, realtime);

    for (let i = 0; i < 20; i += 1) {
      fireTestResults();
      await new Promise((resolve) => setTimeout(resolve, 3));
    }

    await plugin.done({} as PluginContext, store);

    expect(maxConcurrent).toBe(1);
  });

  it("coalesces bursts of updates instead of rendering once per event", async () => {
    const { stream } = createTtyStream();
    const store = createFakeStore();
    const { realtime, fireTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 50 });

    await plugin.start({} as PluginContext, store, realtime);

    for (let i = 0; i < 30; i += 1) {
      fireTestResults();
    }

    await plugin.done({} as PluginContext, store);

    expect(store.callCount()).toBeLessThan(30);
  });

  it("contains render failures and continues processing later updates", async () => {
    const { stream } = createTtyStream();
    const store = createFakeStore();
    const { realtime, fireTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 0 });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalTestsStatistic = store.testsStatistic;

    store.testsStatistic = vi
      .fn()
      .mockRejectedValueOnce(new Error("store unavailable"))
      .mockImplementation(originalTestsStatistic);

    await plugin.start({} as PluginContext, store, realtime);

    fireTestResults();

    await new Promise((resolve) => setTimeout(resolve, 0));

    fireTestResults();

    await plugin.done({} as PluginContext, store);

    expect(consoleErrorSpy).toHaveBeenCalledWith("can't render progress", expect.any(Error));
    expect(store.testsStatistic).toHaveBeenCalledTimes(3);
  });

  it("detaches the stream interceptor when the final render fails", async () => {
    const { stream } = createTtyStream();
    const originalWrite = stream.write;
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 0 });
    const patchedWrite = stream.write;
    const store = {
      testsStatistic: vi.fn().mockRejectedValue(new Error("store unavailable")),
    } as unknown as AllureStore;

    await expect(plugin.done({} as PluginContext, store)).rejects.toThrow("store unavailable");

    expect(patchedWrite).not.toBe(originalWrite);
    expect(stream.write).not.toBe(patchedWrite);
  });

  it("terminates the in-place line before foreign output so it never glues on", async () => {
    const { stream, getOutput } = createTtyStream();
    const store = createFakeStore();
    const { realtime, fireTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 10 });

    store.setStatistic(1, 0, 0);
    await plugin.start({} as PluginContext, store, realtime);
    fireTestResults();
    await new Promise((resolve) => setTimeout(resolve, 30));

    // a foreign writer (another plugin's logger) writes to the same stream mid-line
    stream.write("[OtherPlugin]: some log line\n");

    const output = getOutput();

    expect(output).not.toContain("total: 1[OtherPlugin]");
    expect(output).toContain("[OtherPlugin]: some log line\n");

    await plugin.done({} as PluginContext, store);
  });

  it("falls back to one line per update on non-TTY streams", async () => {
    const stream = new PassThrough() as unknown as PassThrough & { isTTY: boolean };

    stream.isTTY = false;

    let output = "";

    stream.on("data", (chunk) => {
      output += chunk.toString();
    });

    const store = createFakeStore();
    const { realtime, fireTestResults } = createRealtime();
    const plugin = new ProgressPlugin({ stream: stream as any, minRenderIntervalMs: 10 });

    store.setStatistic(2, 0, 3);
    await plugin.start({} as PluginContext, store, realtime);
    fireTestResults();
    await plugin.done({} as PluginContext, store);

    const lines = output.split("\n").filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.at(-1)).toContain("total: 5");
  });
});

describe("Terminal", () => {
  it("keeps the shared stream interceptor until the last terminal detaches", () => {
    const { stream, getOutput } = createTtyStream();
    const first = new Terminal(stream as any);
    const second = new Terminal(stream as any);

    first.write("progress");
    second.detach();
    stream.write("foreign\n");
    first.detach();

    expect(getOutput()).toContain("progress\nforeign\n");
  });
});
