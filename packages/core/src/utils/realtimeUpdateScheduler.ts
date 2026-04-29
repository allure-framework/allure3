import { setTimeout } from "node:timers/promises";

type RealtimeUpdateSchedulerPhase = "idle" | "scheduled" | "running";

export interface RealtimeUpdateSchedulerOptions {
  cooldownMs?: number;
}

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
      await this.#worker();
    } while (this.#dirty);
  };
}
