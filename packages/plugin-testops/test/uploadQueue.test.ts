import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UploadQueue } from "../src/uploadQueue.js";

beforeEach(async () => {
  await story("uploadQueue");
});

const axiosError = (status: number | undefined, message?: string) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status, data: message ? { message } : {} },
});

describe("UploadQueue", () => {
  describe("run", () => {
    it("returns the value on success without deferring", async () => {
      const queue = new UploadQueue();
      const task = vi.fn().mockResolvedValue("ok");

      const result = await queue.run("test-results", task, { baseDelayMs: 0 });

      expect(result).toEqual({ deferred: false, value: "ok" });
      expect(queue.pendingNames).toEqual([]);
    });

    it("rethrows a terminal error without deferring", async () => {
      const queue = new UploadQueue();
      const task = vi.fn().mockRejectedValue(axiosError(401));

      await expect(queue.run("test-results", task, { baseDelayMs: 0 })).rejects.toEqual(axiosError(401));
      expect(queue.pendingNames).toEqual([]);
    });

    it("defers a batch that survives the hot-retry budget instead of dropping it", async () => {
      const queue = new UploadQueue();
      const task = vi.fn().mockRejectedValue(axiosError(503));
      const onDeferred = vi.fn();

      const result = await queue.run("test-results", task, { baseDelayMs: 0, maxRetries: 1, onDeferred });

      expect(result).toEqual({ deferred: true });
      expect(queue.pendingNames).toEqual(["test-results"]);
      expect(onDeferred).toHaveBeenCalledWith(axiosError(503));
    });

    it("keeps hot-retrying a plain service-transient error on later calls (does not suspend)", async () => {
      const queue = new UploadQueue();
      const firstTask = vi.fn().mockRejectedValue(axiosError(503));

      await queue.run("global-errors", firstTask, { baseDelayMs: 0, maxRetries: 0 });

      const secondTask = vi.fn().mockResolvedValue("ok");
      const result = await queue.run("global-errors", secondTask, { baseDelayMs: 0 });

      expect(result).toEqual({ deferred: false, value: "ok" });
      expect(secondTask).toHaveBeenCalledTimes(1);
      expect(queue.pendingNames).toEqual([]);
    });

    it("suspends further uploads without hitting the network once a resource-recoverable error survives retries", async () => {
      const queue = new UploadQueue();
      const closedLaunchError = axiosError(423, "Launch is closed");
      const firstTask = vi.fn().mockRejectedValue(closedLaunchError);

      await queue.run("test-results", firstTask, { baseDelayMs: 0, maxRetries: 0 });

      const secondTask = vi.fn().mockResolvedValue("ok");
      const onDeferred = vi.fn();
      const result = await queue.run("test-results", secondTask, { baseDelayMs: 0, onDeferred });

      expect(result).toEqual({ deferred: true });
      expect(secondTask).not.toHaveBeenCalled();
      expect(onDeferred).toHaveBeenCalledWith();
    });

    it("replaces a pending task for the same name instead of appending", async () => {
      const queue = new UploadQueue();
      const closedLaunchError = axiosError(423, "Launch is closed");

      await queue.run("global-attachments", vi.fn().mockRejectedValue(closedLaunchError), {
        baseDelayMs: 0,
        maxRetries: 0,
      });

      const newerTask = vi.fn().mockResolvedValue("newer");
      await queue.run("global-attachments", newerTask, { baseDelayMs: 0 });

      expect(queue.pendingNames).toEqual(["global-attachments"]);

      const stillPending = await queue.flush({ baseDelayMs: 0 });

      expect(stillPending).toEqual([]);
      expect(newerTask).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush", () => {
    it("uploads every pending task and clears them on success", async () => {
      const queue = new UploadQueue();
      const closedLaunchError = axiosError(423, "Launch is closed");

      await queue.run("test-results", vi.fn().mockRejectedValue(closedLaunchError), { baseDelayMs: 0, maxRetries: 0 });
      await queue.run("global-attachments", vi.fn().mockResolvedValue("ok"), { baseDelayMs: 0 });

      const trTask = vi.fn().mockResolvedValue("ok");
      await queue.run("test-results", trTask, { baseDelayMs: 0 });

      const stillPending = await queue.flush({ baseDelayMs: 0 });

      expect(stillPending).toEqual([]);
      expect(trTask).toHaveBeenCalledTimes(1);
      expect(queue.pendingNames).toEqual([]);
    });

    it("keeps a task pending and reports its name when it still fails at finalization", async () => {
      const queue = new UploadQueue();

      await queue.run("test-results", vi.fn().mockRejectedValue(axiosError(503)), { baseDelayMs: 0, maxRetries: 0 });

      const stillPending = await queue.flush({ baseDelayMs: 0, maxRetries: 0 });

      expect(stillPending).toEqual(["test-results"]);
      expect(queue.pendingNames).toEqual(["test-results"]);
    });

    it("returns an empty list and does nothing when there is nothing pending", async () => {
      const queue = new UploadQueue();

      await expect(queue.flush({ baseDelayMs: 0 })).resolves.toEqual([]);
    });
  });
});
