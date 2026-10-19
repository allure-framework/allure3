import { performance } from "node:perf_hooks";

import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_UPLOAD_RATE_LIMIT, UploadPacer } from "../src/uploadPacer.js";

beforeEach(async () => {
  await story("uploadPacer");
});

describe("UploadPacer", () => {
  it("never waits when pacing is explicitly disabled", async () => {
    const pacer = new UploadPacer(false);
    const start = performance.now();

    await pacer.wait({ requests: 1, files: 1000, bytes: 1_000_000 });

    expect(performance.now() - start).toBeLessThan(20);
  });

  it("paces with sane defaults when no rate limit is given, not left disabled", async () => {
    const pacer = new UploadPacer(undefined);
    const start = performance.now();

    await pacer.wait({ requests: 1, files: 1 });

    expect(performance.now() - start).toBeLessThan(20);

    await pacer.wait({ requests: DEFAULT_UPLOAD_RATE_LIMIT.maxRequestsPerWindow });

    let resolved = false;
    const pending = pacer.wait({ requests: 1 }).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await pending.catch(() => {});
  });

  it("does not delay a request within budget", async () => {
    const pacer = new UploadPacer({ windowMs: 10_000, maxRequestsPerWindow: 5 });
    const start = performance.now();

    await pacer.wait({ requests: 1 });

    expect(performance.now() - start).toBeLessThan(20);
  });

  it("paces a request once the per-window request budget is exceeded", async () => {
    const windowMs = 80;
    const pacer = new UploadPacer({ windowMs, maxRequestsPerWindow: 1 });

    await pacer.wait({ requests: 1 });

    const start = performance.now();

    await pacer.wait({ requests: 1 });

    expect(performance.now() - start).toBeGreaterThanOrEqual(windowMs - 15);
  });

  it("treats requests, files, and bytes as independent budgets", async () => {
    const windowMs = 80;
    const pacer = new UploadPacer({
      windowMs,
      maxRequestsPerWindow: 100,
      maxFilesPerWindow: 100,
      maxBytesPerWindow: 10,
    });

    await pacer.wait({ requests: 1, files: 1, bytes: 10 });

    const start = performance.now();

    await pacer.wait({ requests: 1, files: 1, bytes: 10 });

    expect(performance.now() - start).toBeGreaterThanOrEqual(windowMs - 15);
  });

  it("charges an oversized batch proportionally instead of clamping it to a single window", async () => {
    const windowMs = 40;
    const limit = 5;
    const pacer = new UploadPacer({ windowMs, maxFilesPerWindow: limit });

    await pacer.wait({ files: limit * 3 });

    const start = performance.now();

    await pacer.wait({ files: 1 });

    const elapsed = performance.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(windowMs * 2.5);
  });

  it("aborts the wait when the given signal is aborted", async () => {
    const pacer = new UploadPacer({ windowMs: 10_000, maxRequestsPerWindow: 1 });

    await pacer.wait({ requests: 1 });

    const controller = new AbortController();
    const pending = pacer.wait({ requests: 1 }, controller.signal);

    controller.abort();

    await expect(pending).rejects.toThrow();
  });
});
