import * as process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import type { WriteStream } from "node:tty";

import type { AllureStore, Plugin, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import { green, red, yellow } from "yoctocolors";

import { Terminal } from "./terminal.js";

const DEFAULT_MIN_RENDER_INTERVAL_MS = 300;

export class ProgressPlugin implements Plugin {
  readonly #terminal?: Terminal;
  readonly #minRenderIntervalMs: number;
  #lastRenderAt = 0;
  #pendingStore: AllureStore | undefined;
  #pumping = false;
  #pumpDone: Promise<void> = Promise.resolve();

  constructor(readonly options: { stream?: WriteStream; minRenderIntervalMs?: number } = {}) {
    const { stream = process.stdout, minRenderIntervalMs = DEFAULT_MIN_RENDER_INTERVAL_MS } = this.options;
    if (stream) {
      this.#terminal = new Terminal(stream);
    }
    this.#minRenderIntervalMs = minRenderIntervalMs;
  }

  start = async (context: PluginContext, store: AllureStore, realtime: RealtimeSubscriber): Promise<void> => {
    realtime.onTestResults(async () => {
      this.#pendingStore = store;

      if (!this.#pumping) {
        this.#pumpDone = this.#pump();
      }
    });
  };

  done = async (context: PluginContext, store: AllureStore): Promise<void> => {
    // wait for any in-flight render first, then force a final unthrottled one with fresh numbers
    await this.#pumpDone;
    await this.#render(store);

    // commit the in-place line so later output doesn't glue onto it
    if (this.#terminal?.isTTY()) {
      this.#terminal.newline();
    }

    this.#terminal?.detach();
  };

  // coalesces bursty result events into at most one #render in flight, spaced #minRenderIntervalMs apart
  #pump = async (): Promise<void> => {
    this.#pumping = true;

    try {
      while (this.#pendingStore) {
        const elapsed = Date.now() - this.#lastRenderAt;
        const wait = Math.max(0, this.#minRenderIntervalMs - elapsed);

        if (wait > 0) {
          await delay(wait);
        }

        const store = this.#pendingStore;

        this.#pendingStore = undefined;
        this.#lastRenderAt = Date.now();

        await this.#render(store);
      }
    } finally {
      this.#pumping = false;
    }
  };

  #render = async (store: AllureStore) => {
    if (!this.#terminal) {
      return;
    }

    const testsStatistic = await store.testsStatistic();
    const parts = [
      testsStatistic.failed ? `${red("failed")}: ${testsStatistic.failed}` : undefined,
      testsStatistic.broken ? `${yellow("broken")}: ${testsStatistic.broken}` : undefined,
      testsStatistic.passed ? `${green("passed")}: ${testsStatistic.passed}` : undefined,
      `total: ${testsStatistic.total}`,
    ].filter((part): part is string => !!part);
    const line = parts.join("  ");

    if (!this.#terminal.isTTY()) {
      // no in-place redraw without a real terminal
      this.#terminal.write(line);
      this.#terminal.newline();
      return;
    }

    // single-line redraw: no row-count bookkeeping to desync when other output interleaves
    this.#terminal.cursorTo(0);
    this.#terminal.clearLine();
    this.#terminal.write(line);
  };
}
