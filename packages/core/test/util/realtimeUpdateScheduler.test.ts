import { setTimeout } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import { RealtimeUpdateScheduler } from "../../src/utils/realtimeUpdateScheduler.js";

const createSignal = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("RealtimeUpdateScheduler", () => {
  it("should run an idle request after cooldown", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    scheduler.request();
    await scheduler.flush();

    expect(worker).toBeCalledTimes(1);
  });

  it("should not overlap active updates", async () => {
    const blockUpdate = createSignal();
    const updateStarted = createSignal();
    let activeUpdates = 0;
    let maxActiveUpdates = 0;

    const scheduler = new RealtimeUpdateScheduler(
      vi.fn(async () => {
        activeUpdates += 1;
        maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
        updateStarted.resolve();
        await blockUpdate.promise;
        activeUpdates -= 1;
      }),
      { cooldownMs: 1 },
    );

    scheduler.request();
    await updateStarted.promise;
    scheduler.request();
    await setTimeout(5);

    expect(maxActiveUpdates).toBe(1);

    blockUpdate.resolve();
    await scheduler.flush();

    expect(maxActiveUpdates).toBe(1);
  });

  it("should collapse many requests during active update into one follow-up", async () => {
    const blockUpdate = createSignal();
    const firstUpdateStarted = createSignal();
    const worker = vi
      .fn()
      .mockImplementationOnce(async () => {
        firstUpdateStarted.resolve();
        await blockUpdate.promise;
      })
      .mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    scheduler.request();
    await firstUpdateStarted.promise;

    scheduler.request();
    scheduler.request();
    scheduler.request();

    blockUpdate.resolve();
    await scheduler.flush();

    expect(worker).toBeCalledTimes(2);
  });

  it("should not schedule a follow-up for requests before update starts", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 10 });

    scheduler.request();
    scheduler.request();
    scheduler.request();

    await scheduler.flush();

    expect(worker).toBeCalledTimes(1);
  });

  it("should schedule another pass when request arrives during a follow-up", async () => {
    let scheduler!: RealtimeUpdateScheduler;
    const blockUpdate = createSignal();
    const firstUpdateStarted = createSignal();
    let calls = 0;
    const worker = vi.fn(async () => {
      calls += 1;

      if (calls === 1) {
        firstUpdateStarted.resolve();
        await blockUpdate.promise;
      }

      if (calls === 2) {
        scheduler.request();
      }
    });
    scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    scheduler.request();
    await firstUpdateStarted.promise;
    scheduler.request();

    blockUpdate.resolve();
    await scheduler.flush();

    expect(worker).toBeCalledTimes(3);
  });

  it("should close after active and already-requested dirty updates settle", async () => {
    const blockUpdate = createSignal();
    const firstUpdateStarted = createSignal();
    const worker = vi
      .fn()
      .mockImplementationOnce(async () => {
        firstUpdateStarted.resolve();
        await blockUpdate.promise;
      })
      .mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    scheduler.request();
    await firstUpdateStarted.promise;
    scheduler.request();

    const closePromise = scheduler.close();
    await setTimeout(5);

    expect(worker).toBeCalledTimes(1);

    blockUpdate.resolve();
    await closePromise;

    expect(worker).toBeCalledTimes(2);
  });

  it("should ignore requests after close", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    await scheduler.close();
    scheduler.request();
    await setTimeout(5);

    expect(worker).not.toBeCalled();
  });

  it("should surface worker failures to flush callers", async () => {
    const error = new Error("update failed");
    const scheduler = new RealtimeUpdateScheduler(vi.fn().mockRejectedValue(error), { cooldownMs: 1 });

    scheduler.request();

    await expect(scheduler.flush()).rejects.toBe(error);
  });

  it("should ignore requests during scheduled cooldown", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 50 });

    scheduler.request();
    scheduler.request();
    await setTimeout(5);

    expect(worker).not.toBeCalled();

    await scheduler.flush();

    expect(worker).toBeCalledTimes(1);
  });

  it("should surface completed background failures to close callers", async () => {
    const error = new Error("update failed");
    const scheduler = new RealtimeUpdateScheduler(vi.fn().mockRejectedValue(error), { cooldownMs: 1 });

    scheduler.request();
    await setTimeout(5);

    await expect(scheduler.close()).rejects.toBe(error);
  });

  it("should surface failures to late flush callers after cycle settles", async () => {
    const error = new Error("update failed");
    const scheduler = new RealtimeUpdateScheduler(vi.fn().mockRejectedValue(error), { cooldownMs: 1 });

    scheduler.request();
    await setTimeout(5);

    await expect(scheduler.flush()).rejects.toBe(error);
  });

  it("should not carry dirty state from a failed cycle into the next request", async () => {
    const blockUpdate = createSignal();
    const firstUpdateStarted = createSignal();
    const error = new Error("update failed");
    const worker = vi
      .fn()
      .mockImplementationOnce(async () => {
        firstUpdateStarted.resolve();
        await blockUpdate.promise;
        throw error;
      })
      .mockResolvedValue(undefined);
    const scheduler = new RealtimeUpdateScheduler(worker, { cooldownMs: 1 });

    scheduler.request();
    await firstUpdateStarted.promise;
    scheduler.request();
    blockUpdate.resolve();

    await expect(scheduler.flush()).rejects.toBe(error);

    scheduler.request();
    await scheduler.flush();

    expect(worker).toBeCalledTimes(2);
  });
});
