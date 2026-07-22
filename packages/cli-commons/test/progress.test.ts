import { describe, expect, it, vi } from "vitest";

import { createProgressLogger } from "../src/utils/progress.js";

describe("createProgressLogger", () => {
  it("omits prefix when not set", () => {
    const log = vi.fn();
    const logger = createProgressLogger({
      total: 1,
      message: "Publishing report",
      unitLabel: "files uploaded",
      log,
    });

    logger.log(true);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Publishing report: 0/1 files uploaded");
  });

  it("debounces progress logs periodically and flushes final total", () => {
    vi.useFakeTimers();

    const log = vi.fn();
    const logger = createProgressLogger({
      total: 10,
      message: "Publishing report",
      unitLabel: "files uploaded",
      debounceMs: 1_000,
      log,
    });

    try {
      logger.log(true);
      for (let index = 0; index < 4; index += 1) {
        logger.increment();
        vi.advanceTimersByTime(250);
      }

      expect(log).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenNthCalledWith(1, "Publishing report: 0/10 files uploaded");
      expect(log).toHaveBeenNthCalledWith(2, "Publishing report: 4/10 files uploaded");

      for (let index = 0; index < 4; index += 1) {
        logger.increment();
        vi.advanceTimersByTime(250);
      }

      expect(log).toHaveBeenCalledTimes(3);
      expect(log).toHaveBeenNthCalledWith(3, "Publishing report: 8/10 files uploaded");

      logger.increment(2);

      expect(log).toHaveBeenCalledTimes(4);
      expect(log).toHaveBeenNthCalledWith(4, "Publishing report: 10/10 files uploaded");

      vi.advanceTimersByTime(1_000);
      expect(log).toHaveBeenCalledTimes(4);
      expect(logger.getCurrent()).toBe(10);
    } finally {
      logger.cancel?.();
      vi.useRealTimers();
    }
  });
});
