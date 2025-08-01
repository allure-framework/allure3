import { EventEmitter } from "node:events";
import { setTimeout } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { AllureStoreEvents, RealtimeEventsSubscriber } from "../../src/utils/event.js";

const getRandomInt = (max: number): number => Math.floor(Math.random() * max);

describe("Events", () => {
  it("should batch test result events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeEventsSubscriber(emitter);

    const listener = vi.fn();
    events.onTestResults(listener);

    const result: string[] = [];
    for (let i = 1; i < 10; i++) {
      const id = `id${i}`;
      emitter.emit("testResult", id);
      result.push(id);
    }

    // default batch timeout is set to 100
    await setTimeout(120);

    expect(listener).toBeCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(result);
  });

  it("should batch async test result events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeEventsSubscriber(emitter);

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
    promises.push(setTimeout(170));

    await Promise.allSettled(promises);

    expect(listener).toBeCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(expect.arrayContaining(result));
  });

  it("should send multiple test result event batches", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeEventsSubscriber(emitter);

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
    promises.push(setTimeout(320));

    await Promise.allSettled(promises);

    expect(listener).toBeCalledTimes(2);
    expect(listener.mock.calls[0][0]).toEqual(expect.arrayContaining(batch1));
    expect(listener.mock.calls[1][0]).toEqual(expect.arrayContaining(batch2));
  });

  it("should send test result events to all subscribers", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeEventsSubscriber(emitter);

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
    promises.push(setTimeout(170));

    await Promise.allSettled(promises);

    expect(l1).toBeCalledTimes(1);
    expect(l1.mock.calls[0][0]).toEqual(expect.arrayContaining(result));

    expect(l2).toBeCalledTimes(1);
    expect(l2.mock.calls[0][0]).toEqual(expect.arrayContaining(result));
  });

  it("should stop all events", async () => {
    const emitter = new EventEmitter<AllureStoreEvents>();
    const events = new RealtimeEventsSubscriber(emitter);
    const listener = vi.fn();
    events.onTestResults(listener);
    emitter.emit("testResult", "123");
    events.offAll();
    // default batch timeout is set to 100
    await setTimeout(120);
    expect(listener).toBeCalledTimes(0);
  });
});
