import { ExpressionError } from "@allurereport/core-api";
import { expect, it, vi } from "vite-plus/test";

import { createLiveIngestionFailureHandler } from "../../../src/commands/commons/liveIngestionFailure.js";

it("retains the first fatal error and stops reading subsequent results", async () => {
  const failure = createLiveIngestionFailureHandler();
  const error = new ExpressionError("invalid matcher");
  const nextRead = vi.fn();

  await failure.read(async () => {
    throw error;
  });
  await failure.read(nextRead);

  expect([await failure.failed, failure.getError(), nextRead.mock.calls.length]).toEqual([error, error, 0]);
});

it("leaves ordinary file errors in the watcher retry path", async () => {
  const failure = createLiveIngestionFailureHandler();
  const error = new Error("file is incomplete");

  const reading = failure.read(async () => {
    throw error;
  });

  await expect(reading).rejects.toBe(error);
  expect(failure.getError()).toBeUndefined();
});
