import console from "node:console";
import { EventEmitter } from "node:events";
import { setTimeout } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import { AllureStoreEvents, RealtimeSubscriber } from "../../src/utils/event.js";
import { RealtimeChannel } from "../../src/utils/realtimeChannel.js";

const getRandomInt = (max: number): number => Math.floor(Math.random() * max);

describe("Events", () => {
  it("should batch test result events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);

    const listener = vi.fn();
    events.onTestResults(listener);

    const result: string[] = [];
    for (let i = 1; i < 10; i++) {
      const id = `id${i}`;
      emitter.emit("testResult", id);
      result.push(id);
    }

    // default batch timeout is set to 100
    await setTimeout(150);

    expect(listener).toBeCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(result);
  });

  it("should batch async test result events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);

    const listener = vi.fn();
    events.onTestResults(listener);

    const result: string[] = [];
    const promises: Promise<any>[] = [];
    for (let i = 1; i < 10; i++) {
      const id = `id${i}`;
      const delay = getRandomInt(50);
      const timeout = setTimeout(delay).then(() => emitter.emit("testResult", id));
      promises.push(timeout);
      result.push(id);
    }

    // default batch timeout is set to 100 + max init delay is 50 (if all emits with 50ms delay)
    promises.push(setTimeout(200));

    await Promise.allSettled(promises);

    expect(listener).toBeCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(expect.arrayContaining(result));
  });

  it("should send multiple test result event batches", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);

    const listener = vi.fn();
    events.onTestResults(listener);

    const promises: Promise<any>[] = [];

    const batch1: string[] = [];
    for (let i = 1; i < 10; i++) {
      const id = `id${i}`;
      const delay = getRandomInt(50);
      const timeout = setTimeout(delay).then(() => emitter.emit("testResult", id));
      promises.push(timeout);
      batch1.push(id);
    }

    const batch2: string[] = [];
    for (let i = 11; i < 20; i++) {
      const id = `id${i}`;
      // batches depends on the first event,
      // the first batch is sometime between 0ms-100ms or 50ms-150ms depends on the first emit
      // we should ensure the second batch starts after 150ms
      const delay = getRandomInt(50) + 151;
      const timeout = setTimeout(delay).then(() => emitter.emit("testResult", id));
      promises.push(timeout);
      batch2.push(id);
    }

    // the worst possible end of the second batch is 50 + 151 + 100 = 301
    promises.push(setTimeout(350));

    await Promise.allSettled(promises);

    expect(listener).toBeCalledTimes(2);
    expect(listener.mock.calls[0][0]).toEqual(expect.arrayContaining(batch1));
    expect(listener.mock.calls[1][0]).toEqual(expect.arrayContaining(batch2));
  });

  it("should send test result events to all subscribers", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);

    const l1 = vi.fn();
    const l2 = vi.fn();
    events.onTestResults(l1);
    events.onTestResults(l2);

    const result: string[] = [];
    const promises: Promise<any>[] = [];
    for (let i = 1; i < 10; i++) {
      const id = `id${i}`;
      const delay = getRandomInt(50);
      const timeout = setTimeout(delay).then(() => emitter.emit("testResult", id));
      promises.push(timeout);
      result.push(id);
    }

    // default batch timeout is set to 100 + max init delay is 50 (if all emits with 50ms delay)
    promises.push(setTimeout(200));

    await Promise.allSettled(promises);

    expect(l1).toBeCalledTimes(1);
    expect(l1.mock.calls[0][0]).toEqual(expect.arrayContaining(result));

    expect(l2).toBeCalledTimes(1);
    expect(l2.mock.calls[0][0]).toEqual(expect.arrayContaining(result));
  });

  it("should stop all events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const listener = vi.fn();
    events.onTestResults(listener);
    emitter.emit("testResult", "123");
    events.offAll();
    // default batch timeout is set to 100
    await setTimeout(150);
    expect(listener).toBeCalledTimes(0);
  });

  it("should abort pending batched events on unsubscribe", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const listener = vi.fn();
    const unsubscribe = events.onTestResults(listener);

    emitter.emit("testResult", "123");
    unsubscribe();

    // default batch timeout is set to 100
    await setTimeout(150);

    expect(listener).not.toBeCalled();
  });

  it("should support sync batched listeners", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const result: string[][] = [];

    events.onTestResults((ids) => {
      result.push(ids);
    });
    emitter.emit("testResult", "123");

    // default batch timeout is set to 100
    await setTimeout(150);

    expect(result).toEqual([["123"]]);
  });

  it("should log batched listener errors", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const error = new Error("listener failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    events.onTestResults(vi.fn().mockRejectedValue(error));
    emitter.emit("testResult", "123");

    // default batch timeout is set to 100
    await setTimeout(150);

    expect(consoleError).toBeCalledWith("can't execute listener", error);

    consoleError.mockRestore();
  });

  it("should wait for an active batched listener before delivering the next batch", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    let releaseFirstBatch!: () => void;
    const firstBatch = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });
    const listener = vi.fn((ids: string[]) => (ids.includes("first") ? firstBatch : undefined));

    events.onTestResults(listener);
    emitter.emit("testResult", "first");

    // default batch timeout is set to 100
    await setTimeout(150);
    expect(listener).toBeCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(["first"]);

    emitter.emit("testResult", "second");

    // The second batch should stay buffered while the first listener is still active.
    await setTimeout(150);
    expect(listener).toBeCalledTimes(1);

    releaseFirstBatch();
    await setTimeout(150);

    expect(listener).toBeCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(["second"]);
  });

  it("should start direct listeners synchronously", () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const listener = vi.fn(() => Promise.resolve());

    events.onGlobalError(listener);
    emitter.emit("globalError", { message: "global failure" });

    expect(listener).toBeCalledWith({ message: "global failure" });
  });

  it("should log direct listener errors", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const error = new Error("listener failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    events.onGlobalError(vi.fn().mockRejectedValue(error));
    emitter.emit("globalError", { message: "global failure" });

    await setTimeout(0);

    expect(consoleError).toBeCalledWith("can't execute listener", error);

    consoleError.mockRestore();
  });

  it("should log direct listener sync throws", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeSubscriber(emitter);
    const error = new Error("listener failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    events.onGlobalError(
      vi.fn((): Promise<void> => {
        throw error;
      }),
    );
    emitter.emit("globalError", { message: "global failure" });

    await setTimeout(0);

    expect(consoleError).toBeCalledWith("can't execute listener", error);

    consoleError.mockRestore();
  });

  it("should synchronously notify when result-like events change", () => {
    const channel = new RealtimeChannel();
    const listener = vi.fn();

    channel.onResultLikeChanged(listener);

    channel.dispatcher.sendTestResult("tr-1");
    channel.dispatcher.sendTestFixtureResult("tfr-1");
    channel.dispatcher.sendAttachmentFile("af-1");

    expect(listener).toBeCalledTimes(3);
  });

  it("should unsubscribe from result-like change events", () => {
    const channel = new RealtimeChannel();
    const listener = vi.fn();
    const unsubscribe = channel.onResultLikeChanged(listener);

    unsubscribe();
    channel.dispatcher.sendTestResult("tr-1");
    channel.dispatcher.sendTestFixtureResult("tfr-1");
    channel.dispatcher.sendAttachmentFile("af-1");

    expect(listener).not.toBeCalled();
  });

  it("should stop result-like change events via channel close", () => {
    const channel = new RealtimeChannel();
    const listener = vi.fn();

    channel.onResultLikeChanged(listener);
    channel.close();

    channel.dispatcher.sendTestResult("tr-1");
    channel.dispatcher.sendTestFixtureResult("tfr-1");
    channel.dispatcher.sendAttachmentFile("af-1");

    expect(listener).not.toBeCalled();
  });

  it("should abort pending batched subscriber events via channel close", async () => {
    const channel = new RealtimeChannel();
    const listener = vi.fn();

    channel.subscriber.onTestResults(listener);
    channel.dispatcher.sendTestResult("tr-1");
    channel.close();

    // default batch timeout is set to 100
    await setTimeout(150);

    expect(listener).not.toBeCalled();
  });
});
