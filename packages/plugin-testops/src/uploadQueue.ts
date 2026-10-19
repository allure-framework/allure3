import { ErrorKind, type RetryOptions, classifyError, shouldRetryUpload, withUploadRetry } from "./errors.js";

export type UploadRunResult<T> = { deferred: false; value: T } | { deferred: true };

const isSuspendingError = (error: unknown): boolean => classifyError(error) === ErrorKind.ResourceRecoverable;

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
      this.#pending.delete(name);
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

  async flush(retryOptions: RetryOptions = {}): Promise<string[]> {
    const remaining = new Map(this.#pending);

    for (const [name, task] of this.#pending) {
      try {
        await withUploadRetry(task, retryOptions);
        remaining.delete(name);
      } catch {
        continue;
      }
    }

    this.#pending = remaining;
    this.#suspended = remaining.size > 0;

    return [...remaining.keys()];
  }
}
