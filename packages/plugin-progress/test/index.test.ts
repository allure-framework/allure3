import type { AllureStore, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressPlugin } from "../src/plugin.js";
import { Terminal } from "../src/terminal.js";

beforeEach(async () => {
  await story("index");
});

beforeEach(() => {
  vi.restoreAllMocks();
});

const createRealtime = () => {
  let listener: ((trIds: string[]) => Promise<void>) | undefined;

  return {
    realtime: {
      onTestResults: vi.fn((callback: (trIds: string[]) => Promise<void>) => {
        listener = callback;

        return () => {};
      }),
    } as RealtimeSubscriber,
    emitTestResults: async () => {
      await listener?.([]);
    },
  };
};

const createStore = () =>
  ({
    testsStatistic: vi.fn().mockResolvedValue({ total: 1 }),
  }) as AllureStore;

describe("ProgressPlugin", () => {
  it("appends newline after each render in preserve mode", async () => {
    const cursorRelativeResetSpy = vi.spyOn(Terminal.prototype, "cursorRelativeReset").mockImplementation(() => {});
    const clearLineSpy = vi.spyOn(Terminal.prototype, "clearLine").mockImplementation(() => {});
    const clearBottomSpy = vi.spyOn(Terminal.prototype, "clearBottom").mockImplementation(() => {});
    const newlineSpy = vi.spyOn(Terminal.prototype, "newline").mockImplementation(() => {});
    const writeSpy = vi.spyOn(Terminal.prototype, "write").mockImplementation(() => {});
    const { realtime, emitTestResults } = createRealtime();

    await new ProgressPlugin({ stream: {} as never, preserve: true }).start(
      {} as PluginContext,
      createStore(),
      realtime,
    );

    await emitTestResults();
    await emitTestResults();

    expect(cursorRelativeResetSpy).not.toHaveBeenCalled();
    expect(clearLineSpy).not.toHaveBeenCalled();
    expect(clearBottomSpy).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(newlineSpy).toHaveBeenCalledTimes(2);
  });

  it("rewinds cursor between renders when preserve mode is off", async () => {
    const cursorRelativeResetSpy = vi.spyOn(Terminal.prototype, "cursorRelativeReset").mockImplementation(() => {});
    const clearLineSpy = vi.spyOn(Terminal.prototype, "clearLine").mockImplementation(() => {});
    const clearBottomSpy = vi.spyOn(Terminal.prototype, "clearBottom").mockImplementation(() => {});
    const newlineSpy = vi.spyOn(Terminal.prototype, "newline").mockImplementation(() => {});
    const writeSpy = vi.spyOn(Terminal.prototype, "write").mockImplementation(() => {});
    const { realtime, emitTestResults } = createRealtime();

    await new ProgressPlugin({ stream: {} as never }).start({} as PluginContext, createStore(), realtime);

    await emitTestResults();
    await emitTestResults();

    expect(cursorRelativeResetSpy).toHaveBeenCalledTimes(2);
    expect(clearLineSpy).toHaveBeenCalledTimes(2);
    expect(clearBottomSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(newlineSpy).toHaveBeenCalledTimes(2);
  });
});
