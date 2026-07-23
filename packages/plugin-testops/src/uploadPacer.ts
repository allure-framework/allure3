import { setTimeout as delay } from "node:timers/promises";

import type { UploadRateLimit } from "./model.js";

export type UploadCost = {
  requests?: number;
  files?: number;
  bytes?: number;
};

type RateBudget = {
  limit: number;
  windowMs: number;
  next: number;
};

export const DEFAULT_UPLOAD_RATE_LIMIT: UploadRateLimit = {
  windowMs: 1_000,
  maxRequestsPerWindow: 20,
  maxFilesPerWindow: 1_000,
  maxBytesPerWindow: 1024 * 1024 * 1024,
};

const isBudgetEnabled = (budget: RateBudget): boolean => budget.windowMs > 0 && budget.limit > 0;

// oversized batches are charged as one full window so one large batch can still make progress
// instead of reserving many windows up front
const scaledWindowCost = (windowMs: number, cost: number, limit: number): number => {
  if (windowMs <= 0 || cost <= 0 || limit <= 0) {
    return 0;
  }

  return (windowMs * Math.min(cost, limit)) / limit;
};

export class UploadPacer {
  #requests: RateBudget;
  #files: RateBudget;
  #bytes: RateBudget;
  readonly #now: () => number;

  constructor(rateLimit: UploadRateLimit | false | undefined, now: () => number = Date.now) {
    const resolved = rateLimit === undefined ? DEFAULT_UPLOAD_RATE_LIMIT : rateLimit || undefined;
    const windowMs = resolved?.windowMs ?? 0;

    this.#requests = { limit: resolved?.maxRequestsPerWindow ?? 0, windowMs, next: 0 };
    this.#files = { limit: resolved?.maxFilesPerWindow ?? 0, windowMs, next: 0 };
    this.#bytes = { limit: resolved?.maxBytesPerWindow ?? 0, windowMs, next: 0 };
    this.#now = now;
  }

  async wait(cost: UploadCost, signal?: AbortSignal): Promise<void> {
    const waitMs = this.#reserve(this.#now(), cost);

    if (waitMs <= 0) {
      return;
    }

    await delay(waitMs, undefined, signal ? { signal } : undefined);
  }

  #reserve(now: number, cost: UploadCost): number {
    let start = now;

    for (const budget of [this.#requests, this.#files, this.#bytes]) {
      if (isBudgetEnabled(budget) && budget.next > start) {
        start = budget.next;
      }
    }

    this.#reserveAt(this.#requests, start, cost.requests ?? 0);
    this.#reserveAt(this.#files, start, cost.files ?? 0);
    this.#reserveAt(this.#bytes, start, cost.bytes ?? 0);

    return start > now ? start - now : 0;
  }

  #reserveAt(budget: RateBudget, start: number, cost: number): void {
    if (!isBudgetEnabled(budget) || cost <= 0) {
      return;
    }

    budget.next = start + scaledWindowCost(budget.windowMs, cost, budget.limit);
  }
}
