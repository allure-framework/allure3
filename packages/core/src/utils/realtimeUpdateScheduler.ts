import { setTimeout } from "node:timers/promises";

type RealtimeUpdateSchedulerPhase = "idle" | "scheduled" | "running";

export interface RealtimeUpdateSchedulerOptions {
  cooldownMs?: number;
}

/**
 * Schedules full-report realtime updates without overlapping runs.
 *
 * `request()` marks that a rebuild is needed. The scheduler waits for a short
 * cooldown, runs the worker once, and runs one more pass if more requests arrived
 * while the worker was active. `close()` stops new requests and waits for already
 * scheduled work before final report generation continues.
 *
 * Dynamic cooldown: after each update completes, the scheduler waits at least as
 * long as the update took before starting the next one. This prevents plugin
 * overload when results arrive faster than reports can be regenerated.
 */
export class RealtimeUpdateScheduler {
  readonly #worker: () => Promise<void>;
  readonly #cooldownMs: number;

  #closed = false;
  #dirty = false;
  #phase: RealtimeUpdateSchedulerPhase = "idle";
  #cycle?: Promise<void>;
  #failed = false;
  #failure?: unknown;

  constructor(worker: () => Promise<void>, options: RealtimeUpdateSchedulerOptions = {}) {
    this.#worker = worker;
    this.#cooldownMs = options.cooldownMs ?? 100;
  }

  request(): void {
    if (this.#closed) {
      return;
    }

    if (this.#phase === "running") {
      this.#dirty = true;
      return;
    }

    if (this.#phase === "idle") {
      this.#startCycle();
    }
  }

  async flush(): Promise<void> {
    await this.#cycle;

    if (this.#failed) {
      throw this.#failure;
    }
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.flush();
  }

  #startCycle(): void {
    if (this.#phase !== "idle") {
      return;
    }

    this.#failed = false;
    this.#failure = undefined;
    this.#dirty = false;

    const cycle = this.#runCycle()
      .catch((err) => {
        this.#failed = true;
        this.#failure = err;
        throw err;
      })
      .finally(() => {
        if (this.#cycle === cycle) {
          this.#cycle = undefined;
          this.#phase = "idle";
        }
      });

    // Keep background request cycles observed while still surfacing failures to flush/close callers.
    cycle.catch(() => {});

    this.#cycle = cycle;
  }

  #runCycle = async (): Promise<void> => {
    do {
      this.#phase = "scheduled";
      await setTimeout(this.#cooldownMs);

      this.#phase = "running";
      this.#dirty = false;
      const start = Date.now();
      await this.#worker();
      const elapsed = Date.now() - start;

      // Dynamic cooldown: wait at least as long as the update took before
      // scheduling the next one. This prevents update storms when results
      // arrive faster than plugins can regenerate reports.
      if (this.#dirty && elapsed > this.#cooldownMs) {
        await setTimeout(elapsed - this.#cooldownMs);
      }
    } while (this.#dirty);
  };
}
