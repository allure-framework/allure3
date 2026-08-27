import { ErrorKind, type RetryOptions, classifyError, shouldRetryUpload, withUploadRetry } from "./errors.js";

export type UploadRunResult<T> = { deferred: false; value: T } | { deferred: true };

/**
 * "launch is closed" is the only resource-recoverable kind we see: reopening fixes it, waiting
 * doesn't, so once it survives the hot-retry budget there's no point re-probing on every
 * subsequent upload - defer straight to finalization instead. A transient/network error keeps
 * getting a fresh hot-retry budget on each call (TestOps may already be back).
 */
const isSuspendingError = (error: unknown): boolean => classifyError(error) === ErrorKind.ResourceRecoverable;

/**
 * Defers upload batches that survive the hot-retry budget to finalization instead of dropping
 * them.
 *
 * Each logical upload stream (test results, global attachments, global errors, quality gate)
 * always recomputes its full "still not uploaded" payload from the store on every call, so a
 * newer queued task for the same name is a superset of an older pending one for that name -
 * replacing rather than appending is correct and avoids re-uploading the same data twice.
 */
export class UploadQueue {
  #pending = new Map<string, () => Promise<unknown>>();
  #suspended = false;

  get pendingNames(): string[] {
    return [...this.#pending.keys()];
  }

  async run<T>(
    name: string,
    task: () => Promise<T>,
    options: RetryOptions & { onDeferred?: (error?: unknown) => void } = {},
  ): Promise<UploadRunResult<T>> {
    const { onDeferred, ...retryOptions } = options;

    if (this.#suspended) {
      this.#pending.set(name, task);
      onDeferred?.();
      return { deferred: true };
    }

    try {
      const value = await withUploadRetry(task, retryOptions);
      return { deferred: false, value };
    } catch (error) {
      if (!shouldRetryUpload(error)) {
        throw error;
      }

      this.#pending.set(name, task);
      this.#suspended = isSuspendingError(error);
      onDeferred?.(error);
      return { deferred: true };
    }
  }

  /**
   * Gives every deferred upload one more retry budget at finalization - the last chance before
   * the process exits. Returns the names still unresolved after that.
   */
  async flush(retryOptions: RetryOptions = {}): Promise<string[]> {
    const remaining = new Map(this.#pending);

    for (const [name, task] of this.#pending) {
      try {
        await withUploadRetry(task, retryOptions);
        remaining.delete(name);
      } catch {
        // stays in `remaining`, reported to the caller via the returned names
      }
    }

    this.#pending = remaining;
    this.#suspended = remaining.size > 0;

    return [...remaining.keys()];
  }
}
